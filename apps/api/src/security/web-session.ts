import { randomSecret, sha256, verifyEqual } from "./security-crypto.js";
import { createWalletAuthStore, type Session, type WalletAuthStore } from "./wallet-auth-store.js";
export const SESSION_IDLE_MS = 30 * 60_000; export const SESSION_ABSOLUTE_MS = 24 * 60 * 60_000;
export function createWebSessionManager(store: WalletAuthStore = createWalletAuthStore()) { return {
  async create(walletAddress: string) { if (await store.countSessions(walletAddress) >= 5) return undefined; const now = Date.now(); const token = randomSecret(32); const csrf = randomSecret(24); const session: Session = { id: randomSecret(18), walletAddress, tokenHash: sha256(token), csrfHash: sha256(csrf), createdAt: now, lastSeenAt: now, expiresAt: now + SESSION_ABSOLUTE_MS }; await store.putSession(session); return { token, csrf, session }; },
  async get(token: string) { const s = await store.getSession(sha256(token)); if (!s || s.revokedAt || s.expiresAt <= Date.now() || s.lastSeenAt + SESSION_IDLE_MS <= Date.now()) return undefined; s.lastSeenAt = Date.now(); await store.updateSession(s); return s; },
  async revoke(token: string) { const s = await store.getSession(sha256(token)); if (s) await store.revokeSession(s.id); },
  verifyCsrf(session: Session, csrf: string) { return verifyEqual(sha256(csrf), session.csrfHash); }, store
}; }
