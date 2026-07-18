import test from "node:test";
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import { createWalletAuth } from "./wallet-auth.js";
import { createApiClientAuth } from "./api-client-auth.js";
import { createScryptVerifier, verifyScrypt } from "./security-crypto.js";
test("wallet challenge verifies exact detached signature once", () => { const keys = nacl.sign.keyPair(); const address = Buffer.from(keys.publicKey).toString("base64url"); const auth = createWalletAuth(); const c = auth.issueChallenge(address); const signature = Buffer.from(nacl.sign.detached(new TextEncoder().encode(c.message), keys.secretKey)).toString("base64url"); assert.equal(auth.verifyChallenge({ challengeId:c.id, walletAddress:address, signature, publicKey:address }), true); assert.equal(auth.verifyChallenge({ challengeId:c.id, walletAddress:address, signature, publicKey:address }), false); });
test("scrypt verifier never needs raw secret", () => { const verifier = createScryptVerifier("secret"); assert.equal(verifyScrypt("secret", verifier), true); assert.equal(verifyScrypt("wrong", verifier), false); });
test("client credentials issue opaque expiring scoped token", () => { const auth = createApiClientAuth(); const c = auth.createCredential("app", ["matches:read"]); assert.ok(c); const token = auth.issueToken(c!.clientId, c!.clientSecret); assert.ok(token); assert.equal(token!.expires_in, 600); assert.deepEqual(auth.authenticate(token!.access_token)?.scopes, ["matches:read"]); });
