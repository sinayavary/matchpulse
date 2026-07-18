import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { createPrismaApiClientAuth } from "./api-client-auth.js";
import { createPrismaSecurityDependencies, createUnavailableSecurityDependencies, registerSecurityRoutes } from "./security-routes.js";
import { createPersistentSecurityAuditSink } from "./security-audit.js";
import { createPrismaWalletAuthStore } from "./wallet-auth-store.js";
import { createWebSessionManager } from "./web-session.js";
import { sha256 } from "./security-crypto.js";
import { scopeForRoute } from "./free-access-contract.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the disposable local PostgreSQL suite");
const parsedUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
if (!/^matchpulse_free_access_validation_/.test(databaseName)) throw new Error("database name is outside the disposable validation scope");
if (!(["localhost", "127.0.0.1", "::1"] as string[]).includes(parsedUrl.hostname)) throw new Error("database host is not loopback");

let db = new PrismaClient();
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const walletAddress = `validation_wallet_${suffix}`;
const auditRoute = `/validation/${suffix}`;
let applicationIds: string[] = [];
let walletId: string | undefined;

async function reconnect() {
  await db.$disconnect();
  db = new PrismaClient();
  await db.$connect();
}

async function createApplication(name: string) {
  const wallet = await db.freeAccessWallet.upsert({
    where: { walletAddress },
    create: { walletAddress },
    update: {},
  });
  walletId = wallet.id;
  const application = await db.freeAccessApplication.create({
    data: { id: `validation_app_${suffix}_${applicationIds.length}`, walletId: wallet.id, name, scopes: ["matches:read"] },
  });
  applicationIds.push(application.id);
  return application;
}

before(async () => {
  await db.$connect();
  const meta = await db.$queryRawUnsafe<Array<{ database_name: string; host: string; server_version_num: string }>>(
    "SELECT current_database() AS database_name, inet_server_addr()::text AS host, current_setting($$server_version_num$$) AS server_version_num",
  );
  assert.match(meta[0].database_name, /^matchpulse_free_access_validation_/);
  assert.match(meta[0].host, /127\.0\.0\.1|::1/);
  assert.equal(meta[0].server_version_num.slice(0, 2), "16");
});

test("application scope persists after reconnect", async () => {
  const application = await createApplication("scope persistence");
  await reconnect();
  const row = await db.freeAccessApplication.findUnique({ where: { id: application.id } });
  assert.deepEqual(row?.scopes, ["matches:read"]);
});

test("credential and token persist and authenticate after reconnect", async () => {
  const application = await createApplication("credential persistence");
  const auth = createPrismaApiClientAuth(db);
  const credential = await auth.createCredential(application.id, ["matches:read"]);
  assert.ok(credential);
  await reconnect();
  const reconnectedAuth = createPrismaApiClientAuth(db);
  const token = await reconnectedAuth.issueToken(credential.clientId, credential.clientSecret);
  assert.ok(token);
  const authenticated = await reconnectedAuth.authenticate(token.access_token);
  assert.equal(authenticated?.applicationId, application.id);
});

test("credential revoke invalidates its token", async () => {
  const application = await createApplication("credential revoke");
  const auth = createPrismaApiClientAuth(db);
  const credential = await auth.createCredential(application.id, ["matches:read"]);
  assert.ok(credential);
  const token = await auth.issueToken(credential.clientId, credential.clientSecret);
  assert.ok(token);
  await auth.revokeCredential(credential.clientId);
  assert.equal(await auth.authenticate(token.access_token), undefined);
});

test("application disable invalidates credentials and tokens", async () => {
  const application = await createApplication("application disable");
  const auth = createPrismaApiClientAuth(db);
  const credential = await auth.createCredential(application.id, ["matches:read"]);
  assert.ok(credential);
  const token = await auth.issueToken(credential.clientId, credential.clientSecret);
  assert.ok(token);
  const deps = createPrismaSecurityDependencies(db);
  await deps.applications.disable(application.id);
  await auth.revokeApplication(application.id);
  assert.equal(await auth.authenticate(token.access_token), undefined);
  assert.equal((await db.freeAccessApplication.findUnique({ where: { id: application.id } }))?.status, "DISABLED");
});

test("session persists and logout revoke persists after reconnect", async () => {
  const first = createWebSessionManager(createPrismaWalletAuthStore(db) as any);
  const created = await first.create(walletAddress);
  assert.ok(created);
  await reconnect();
  const second = createWebSessionManager(createPrismaWalletAuthStore(db) as any);
  assert.equal((await second.get(created.token))?.walletAddress, walletAddress);
  await second.revoke(created.token);
  assert.equal(await second.get(created.token), undefined);
});

test("concurrent valid challenge verification has exactly one winner", async () => {
  const challengeId = `validation_challenge_valid_${suffix}`;
  const store = createPrismaWalletAuthStore(db) as any;
  await store.putChallenge({ id: challengeId, walletAddress, domain: "localhost", uri: "/verify", chain: "solana:devnet", nonce: `nonce_${suffix}`, issuedAt: Date.now(), requestId: `request_${suffix}`, hash: `hash_${challengeId}`, expiresAt: Date.now() + 300000, attempts: 0, consumed: false });
  const results = await Promise.all(Array.from({ length: 8 }, () => store.verifyAndConsumeChallenge(challengeId, () => true)));
  assert.equal(results.filter((result: any) => result?.valid && result.consume).length, 1);
  assert.equal((await (createPrismaWalletAuthStore(db) as any).getChallenge(challengeId)).consumed, true);
});

test("invalid attempts persist across clients and lock on the third attempt", async () => {
  const challengeId = `validation_challenge_invalid_${suffix}`;
  const first = createPrismaWalletAuthStore(db) as any;
  await first.putChallenge({ id: challengeId, walletAddress, domain: "localhost", uri: "/verify", chain: "solana:devnet", nonce: `nonce_${suffix}_invalid`, issuedAt: Date.now(), requestId: `request_${suffix}_invalid`, hash: `hash_${challengeId}`, expiresAt: Date.now() + 300000, attempts: 0, consumed: false });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = createPrismaWalletAuthStore(db) as any;
    const result = await client.verifyAndConsumeChallenge(challengeId, () => false);
    assert.equal(result?.valid, false);
  }
  const row = await (createPrismaWalletAuthStore(db) as any).getChallenge(challengeId);
  assert.equal(row.attempts, 3);
  assert.equal(await (createPrismaWalletAuthStore(db) as any).recordInvalidAttempt(challengeId), undefined);
});

test("daily quota increments atomically and survives reconnect", async () => {
  const application = await createApplication("quota persistence");
  const quota = createPrismaSecurityDependencies(db).quota;
  const results = await Promise.all(Array.from({ length: 20 }, () => quota.consume(application.id)));
  assert.equal(results.filter(Boolean).length, 20);
  await reconnect();
  const usage = await createPrismaSecurityDependencies(db).quota.usage(application.id);
  assert.equal(usage.used, 20);
});

test("audit event persists and nested sensitive fields are recursively redacted", async () => {
  const audit = createPersistentSecurityAuditSink({ create: (input) => db.freeAccessAuditEvent.create({ data: { ...input, metadata: input.metadata as any } }) });
  await audit.append({ event: "validation_audit", actor: walletAddress, route: auditRoute, success: true, metadata: { nested: { token: "secret-token", safe: "ok" }, list: [{ privateKey: "hidden" }] } });
  await reconnect();
  const row = await db.freeAccessAuditEvent.findFirst({ where: { route: auditRoute } });
  assert.ok(row);
  assert.deepEqual(row.metadata, { nested: { token: "[REDACTED]", safe: "ok" }, list: [{ privateKey: "[REDACTED]" }] });
});

test("bearer and website-session credential classes remain isolated", async () => {
  const application = await createApplication("credential isolation");
  const auth = createPrismaApiClientAuth(db);
  const credential = await auth.createCredential(application.id, ["matches:read"]);
  assert.ok(credential);
  const token = await auth.issueToken(credential.clientId, credential.clientSecret);
  assert.ok(token);
  const session = await createWebSessionManager(createPrismaWalletAuthStore(db) as any).create(walletAddress);
  assert.ok(session);
  assert.equal(await auth.authenticate(session.token), undefined);
  assert.equal(scopeForRoute("GET", "/api/internal/health"), undefined);
  assert.equal(await auth.authenticate(token.access_token)?.then?.(() => undefined), undefined);
});

test("store failure maps to a generic 503", async () => {
  const app = Fastify();
  registerSecurityRoutes(app, createUnavailableSecurityDependencies());
  await app.ready();
  const response = await app.inject({ method: "GET", url: "/api/auth/session" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { error: "request_rejected", message: "The request could not be completed." });
  await app.close();
});

after(async () => {
  const appIds = applicationIds;
  await db.freeAccessToken.deleteMany({ where: { applicationId: { in: appIds } } });
  await db.freeAccessCredential.deleteMany({ where: { applicationId: { in: appIds } } });
  await db.freeAccessQuota.deleteMany({ where: { applicationId: { in: appIds } } });
  await db.freeAccessAuditEvent.deleteMany({ where: { route: auditRoute } });
  await db.freeAccessChallenge.deleteMany({ where: { walletAddress } });
  if (walletId) await db.freeAccessSession.deleteMany({ where: { walletId } });
  await db.freeAccessApplication.deleteMany({ where: { id: { in: appIds } } });
  await db.freeAccessWallet.deleteMany({ where: { walletAddress } });
  await db.$disconnect();
});
