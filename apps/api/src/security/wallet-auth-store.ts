export type Challenge = { id: string; walletAddress: string; domain: string; uri: string; chain: string; nonce: string; issuedAt: number; requestId: string; hash: string; expiresAt: number; attempts: number; consumed: boolean };
export type Session = { id: string; walletAddress: string; tokenHash: string; csrfHash: string; createdAt: number; lastSeenAt: number; expiresAt: number; revokedAt?: number };
export type ChallengeVerification = { challenge: Challenge; valid: boolean; consume: boolean };
export type WalletAuthStore = { challenges: Map<string, Challenge>; sessions: Map<string, Session>; putChallenge(c: Challenge): void; getChallenge(id: string): Challenge | undefined; updateChallenge(c: Challenge): void; recordInvalidAttempt(id: string): Challenge | undefined; verifyAndConsumeChallenge(id: string, verify: (challenge: Challenge) => boolean): ChallengeVerification | undefined; putSession(s: Session): void; getSession(tokenHash: string): Session | undefined; updateSession(s: Session): void; revokeSession(id: string): void; countSessions(wallet: string): number; };
export function createWalletAuthStore(): WalletAuthStore { const challenges = new Map<string, Challenge>(); const sessions = new Map<string, Session>(); return {
  challenges, sessions,
  putChallenge: c => challenges.set(c.id, c), getChallenge: id => challenges.get(id), updateChallenge: c => challenges.set(c.id, c),
  recordInvalidAttempt: id => { const c = challenges.get(id); if (!c || c.consumed || c.expiresAt <= Date.now() || c.attempts >= 3) return undefined; c.attempts += 1; challenges.set(id, c); return c; },
  verifyAndConsumeChallenge: (id, verify) => { const c = challenges.get(id); if (!c || c.consumed || c.expiresAt <= Date.now() || c.attempts >= 3) return undefined; const valid = verify(c); if (!valid) { c.attempts += 1; challenges.set(id, c); return { challenge: c, valid: false, consume: false }; } c.consumed = true; challenges.set(id, c); return { challenge: c, valid: true, consume: true }; },
  putSession: s => sessions.set(s.id, s), getSession: hash => [...sessions.values()].find(x => x.tokenHash === hash), updateSession: s => sessions.set(s.id, s), revokeSession: id => { const s = sessions.get(id); if (s) { s.revokedAt = Date.now(); sessions.set(id, s); } }, countSessions: wallet => [...sessions.values()].filter(s => s.walletAddress === wallet && !s.revokedAt && s.expiresAt > Date.now()).length
}; }

export function createPrismaWalletAuthStore(db: any): any {
  return {
    challenges: new Map(),
    sessions: new Map(),
    // @ts-ignore Prisma adapter is deliberately structural because generated client types vary by schema generation mode
    async putChallenge(c) { await db.freeAccessChallenge.create({ data: { id: c.id, walletAddress: c.walletAddress, domain: c.domain, uri: c.uri, chain: c.chain, nonce: c.nonce, issuedAt: new Date(c.issuedAt), requestId: c.requestId, challengeHash: c.hash, expiresAt: new Date(c.expiresAt), attempts: c.attempts } }); },
    // @ts-ignore see adapter note above
    async getChallenge(id) { const c = await db.freeAccessChallenge.findUnique({ where: { id } }); return c ? { ...c, issuedAt: c.issuedAt.getTime(), expiresAt: c.expiresAt.getTime(), hash: c.challengeHash, consumed: Boolean(c.consumedAt) } : undefined; },
    // @ts-ignore see adapter note above
    async updateChallenge(c) { await db.freeAccessChallenge.update({ where: { id: c.id }, data: { attempts: c.attempts, consumedAt: c.consumed ? new Date() : null } }); },
    // @ts-ignore see adapter note above
    async recordInvalidAttempt(id) { const r = await db.freeAccessChallenge.updateMany({ where: { id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 3 } }, data: { attempts: { increment: 1 } } }); return r.count === 1 ? this.getChallenge(id) : undefined; },
    // @ts-ignore see adapter note above
    async verifyAndConsumeChallenge(id, verify) {
      const c = await this.getChallenge(id); if (!c || c.consumed || c.expiresAt <= Date.now() || c.attempts >= 3) return undefined;
      if (!verify(c)) { await this.recordInvalidAttempt(id); const updated = await this.getChallenge(id); return updated ? { challenge: updated, valid: false, consume: false } : undefined; }
      const r = await db.freeAccessChallenge.updateMany({ where: { id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 3 } }, data: { consumedAt: new Date() } });
      return r.count === 1 ? { challenge: { ...c, consumed: true }, valid: true, consume: true } : undefined;
    },
    // @ts-ignore see adapter note above
    async putSession(s) { await db.freeAccessSession.create({ data: { id: s.id, wallet: { connectOrCreate: { where: { walletAddress: s.walletAddress }, create: { walletAddress: s.walletAddress } } }, sessionHash: s.tokenHash, csrfHash: s.csrfHash, createdAt: new Date(s.createdAt), lastSeenAt: new Date(s.lastSeenAt), expiresAt: new Date(s.expiresAt) } }); },
    // @ts-ignore see adapter note above
    async getSession(hash) { const s = await db.freeAccessSession.findUnique({ where: { sessionHash: hash }, include: { wallet: true } }); return s ? { id: s.id, walletAddress: s.wallet.walletAddress, tokenHash: s.sessionHash, csrfHash: s.csrfHash, createdAt: s.createdAt.getTime(), lastSeenAt: s.lastSeenAt.getTime(), expiresAt: s.expiresAt.getTime(), revokedAt: s.revokedAt?.getTime() } : undefined; },
    // @ts-ignore see adapter note above
    async updateSession(s) { await db.freeAccessSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date(s.lastSeenAt), revokedAt: s.revokedAt ? new Date(s.revokedAt) : null } }); },
    // @ts-ignore see adapter note above
    async revokeSession(id) { await db.freeAccessSession.update({ where: { id }, data: { revokedAt: new Date() } }); },
    // @ts-ignore see adapter note above
    async countSessions(wallet) { return db.freeAccessSession.count({ where: { wallet: { walletAddress: wallet }, revokedAt: null, expiresAt: { gt: new Date() } } }); }
  };
}
