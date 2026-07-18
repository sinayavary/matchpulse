import nacl from "tweetnacl";
import bs58 from "bs58";
import { randomSecret, sha256 } from "./security-crypto.js";
import { createWalletAuthStore, type WalletAuthStore } from "./wallet-auth-store.js";
export const CHALLENGE_TTL_MS = 300_000; export const MAX_CHALLENGE_ATTEMPTS = 3;
export function canonicalChallenge(input: { walletAddress: string; domain: string; uri: string; chain: string; nonce: string; issuedAt: number; expiresAt: number; requestId: string }) { return ["MatchPulse off-chain sign-in", `Domain: ${input.domain}`, `URI: ${input.uri}`, `Chain: ${input.chain}`, `Wallet: ${input.walletAddress}`, `Nonce: ${input.nonce}`, `Issued-At: ${new Date(input.issuedAt).toISOString()}`, `Expiration: ${new Date(input.expiresAt).toISOString()}`, `Request-ID: ${input.requestId}`].join("\n"); }
function canonicalAddress(publicKey: string) { try { return bs58.encode(Buffer.from(bs58.decode(publicKey))); } catch { return undefined; } }
export function createWalletAuth(store: WalletAuthStore = createWalletAuthStore()) { return {
  issueChallenge(walletAddress: string, context: { domain?: string; uri?: string; chain?: string; requestId?: string } = {}) { const issuedAt = Date.now(); const expiresAt = issuedAt + CHALLENGE_TTL_MS; const nonce = randomSecret(24); const id = randomSecret(18); const challenge = { walletAddress, domain: context.domain ?? "localhost", uri: context.uri ?? "/api/auth/wallet/verify", chain: context.chain ?? "solana:devnet", nonce, issuedAt, expiresAt, requestId: context.requestId ?? randomSecret(12) }; const message = canonicalChallenge(challenge); store.putChallenge({ ...challenge, id, hash: sha256(message), attempts: 0, consumed: false }); return { id, challengeId: id, message, expiresAt: new Date(expiresAt).toISOString(), requestId: challenge.requestId }; },
  verifyChallenge(input: { challengeId?: string; id?: string; walletAddress?: string; signature?: string; publicKey?: string }) { const challengeId = input.challengeId ?? input.id; if (!challengeId || !input.walletAddress || !input.signature || !input.publicKey) return false; const result = store.verifyAndConsumeChallenge(challengeId, c => { if (c.walletAddress !== input.walletAddress) return false; const message = canonicalChallenge(c); try { const key = canonicalAddress(input.publicKey!); const legacy = input.publicKey === c.walletAddress ? Buffer.from(input.publicKey!, "base64url") : undefined; const publicBytes = key === c.walletAddress ? Buffer.from(bs58.decode(input.publicKey!)) : legacy; return Boolean(publicBytes) && nacl.sign.detached.verify(new TextEncoder().encode(message), Buffer.from(input.signature!, "base64url"), publicBytes!); } catch { return false; } }); return result?.valid === true; }, store
}; }

export function createPrismaWalletAuth(db: any) {
  return {
    async issueChallenge(walletAddress: string, context: { domain?: string; uri?: string; chain?: string; requestId?: string } = {}) {
      const issuedAt = Date.now();
      const expiresAt = issuedAt + CHALLENGE_TTL_MS;
      const nonce = randomSecret(24);
      const id = randomSecret(18);
      const challenge = { walletAddress, domain: context.domain ?? "localhost", uri: context.uri ?? "/api/auth/wallet/verify", chain: context.chain ?? "solana:devnet", nonce, issuedAt, expiresAt, requestId: context.requestId ?? randomSecret(12) };
      const message = canonicalChallenge(challenge);
      await db.freeAccessChallenge.create({ data: { id, walletAddress, domain: challenge.domain, uri: challenge.uri, chain: challenge.chain, nonce, issuedAt: new Date(issuedAt), requestId: challenge.requestId, challengeHash: sha256(message), expiresAt: new Date(expiresAt) } });
      return { id, challengeId: id, message, expiresAt: new Date(expiresAt).toISOString(), requestId: challenge.requestId };
    },
    async verifyChallenge(input: { challengeId?: string; id?: string; walletAddress?: string; signature?: string; publicKey?: string }) {
      const id = input.challengeId ?? input.id;
      if (!id || !input.walletAddress || !input.signature || !input.publicKey) return false;
      const challenge = await db.freeAccessChallenge.findUnique({ where: { id } });
      if (!challenge || challenge.walletAddress !== input.walletAddress) return false;
      const message = canonicalChallenge({ ...challenge, issuedAt: challenge.issuedAt.getTime(), expiresAt: challenge.expiresAt.getTime() });
      let valid = false;
      try {
        const key = canonicalAddress(input.publicKey);
        const publicBytes = key === challenge.walletAddress ? Buffer.from(bs58.decode(input.publicKey)) : input.publicKey === challenge.walletAddress ? Buffer.from(input.publicKey, "base64url") : undefined;
        valid = Boolean(publicBytes) && nacl.sign.detached.verify(new TextEncoder().encode(message), Buffer.from(input.signature, "base64url"), publicBytes!);
      } catch { valid = false; }
      if (valid) {
        const result = await db.freeAccessChallenge.updateMany({ where: { id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_CHALLENGE_ATTEMPTS } }, data: { consumedAt: new Date() } });
        return result.count === 1;
      }
      await db.freeAccessChallenge.updateMany({ where: { id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_CHALLENGE_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
      return false;
    }
  };
}
