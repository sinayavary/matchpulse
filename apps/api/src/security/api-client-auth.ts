import { randomSecret, createScryptVerifier, verifyScrypt, sha256 } from "./security-crypto.js";
import { TOKEN_TTL_SECONDS, type ExternalScope, MAX_CREDENTIALS, isPublicScope, requestedScopes } from "./free-access-contract.js";
export type Credential = { id: string; applicationId: string; clientId: string; verifier: string; scopes: ExternalScope[]; revokedAt?: number };
export type Token = { hash: string; applicationId: string; scopes: ExternalScope[]; expiresAt: number; revokedAt?: number };
export type ApiClientStore = { credentials: Map<string, Credential>; tokens: Map<string, Token> };
export type ApiClientAuth = ReturnType<typeof createApiClientAuth>;
export function createApiClientAuth(store: ApiClientStore = { credentials: new Map(), tokens: new Map() }) { return {
  createCredential(applicationId: string, scopes: ExternalScope[]) { if (scopes.length === 0 || scopes.some(s => !isPublicScope(s))) return undefined; if ([...store.credentials.values()].filter(c => c.applicationId === applicationId && !c.revokedAt).length >= MAX_CREDENTIALS) return undefined; const clientId = `mp_${randomSecret(12)}`; const clientSecret = randomSecret(32); store.credentials.set(clientId, { id: randomSecret(12), applicationId, clientId, verifier: createScryptVerifier(clientSecret), scopes: [...scopes] }); return { clientId, clientSecret, scopes: [...scopes] }; },
  issueToken(clientId: string, clientSecret: string, scopeText?: unknown) { const c = store.credentials.get(clientId); if (!c || c.revokedAt || !verifyScrypt(clientSecret, c.verifier)) return undefined; const requested = requestedScopes(scopeText); if (requested && (requested.length === 0 || requested.some(s => !c.scopes.includes(s)))) return undefined; const scopes = requested ?? c.scopes; const token = randomSecret(32); store.tokens.set(sha256(token), { hash: sha256(token), applicationId: c.applicationId, scopes, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000 }); return { access_token: token, token_type: "Bearer", expires_in: TOKEN_TTL_SECONDS, scope: scopes.join(" ") }; },
  authenticate(token: string) { const t = store.tokens.get(sha256(token)); if (!t || t.revokedAt || t.expiresAt <= Date.now()) return undefined; return t; },
  findCredential(clientId: string) { return store.credentials.get(clientId); },
  revokeCredential(clientId: string) { const c = store.credentials.get(clientId); if (c) { c.revokedAt = Date.now(); for (const t of store.tokens.values()) if (t.applicationId === c.applicationId) t.revokedAt = Date.now(); } },
  revokeApplication(applicationId: string) { for (const c of store.credentials.values()) if (c.applicationId === applicationId) { c.revokedAt = Date.now(); for (const t of store.tokens.values()) if (t.applicationId === applicationId) t.revokedAt = Date.now(); } },
  revokeToken(token: string) { const t = store.tokens.get(sha256(token)); if (t) t.revokedAt = Date.now(); }, store
}; }

export function createPrismaApiClientAuth(db: any) {
  const readScopes = (value: unknown) => Array.isArray(value) ? value as ExternalScope[] : [];
  return {
    async createCredential(applicationId: string, scopes: ExternalScope[]) {
      if (scopes.length === 0 || scopes.some(s => !isPublicScope(s))) return undefined;
      const count = await db.freeAccessCredential.count({ where: { applicationId, revokedAt: null } });
      if (count >= MAX_CREDENTIALS) return undefined;
      const clientId = `mp_${randomSecret(12)}`; const clientSecret = randomSecret(32);
      await db.freeAccessCredential.create({ data: { applicationId, clientId, verifier: createScryptVerifier(clientSecret), scopes } });
      return { clientId, clientSecret, scopes: [...scopes] };
    },
    async issueToken(clientId: string, clientSecret: string, scopeText?: unknown) {
      const c = await db.freeAccessCredential.findUnique({ where: { clientId } });
      if (!c || c.revokedAt || !verifyScrypt(clientSecret, c.verifier)) return undefined;
      const requested = requestedScopes(scopeText); const available = readScopes(c.scopes);
      if (requested && (requested.length === 0 || requested.some(s => !available.includes(s)))) return undefined;
      const scopes = requested ?? available; const token = randomSecret(32);
      await db.freeAccessToken.create({ data: { applicationId: c.applicationId, tokenHash: sha256(token), scopes, expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000) } });
      return { access_token: token, token_type: "Bearer", expires_in: TOKEN_TTL_SECONDS, scope: scopes.join(" ") };
    },
    async authenticate(token: string) {
      const row = await db.freeAccessToken.findUnique({ where: { tokenHash: sha256(token) } });
      if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return undefined;
      return { hash: row.tokenHash, applicationId: row.applicationId, scopes: readScopes(row.scopes), expiresAt: row.expiresAt.getTime() };
    },
    async findCredential(clientId: string) { const row = await db.freeAccessCredential.findUnique({ where: { id: clientId } }); return row ? { id: row.id, clientId: row.clientId, applicationId: row.applicationId } : undefined; },
    async revokeCredential(clientId: string) {
      const c = await db.freeAccessCredential.update({ where: { clientId }, data: { revokedAt: new Date() } });
      await db.freeAccessToken.updateMany({ where: { applicationId: c.applicationId, revokedAt: null }, data: { revokedAt: new Date() } });
    },
    async revokeApplication(applicationId: string) {
      await db.freeAccessCredential.updateMany({ where: { applicationId, revokedAt: null }, data: { revokedAt: new Date() } });
      await db.freeAccessToken.updateMany({ where: { applicationId, revokedAt: null }, data: { revokedAt: new Date() } });
    },
    async revokeToken(token: string) { await db.freeAccessToken.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } }); }
  };
}
