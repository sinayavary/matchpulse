import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { authorizeExternal } from "./api-access-boundary.js";
import { createPrismaApiClientAuth } from "./api-client-auth.js";
import { createPrismaSecurityDependencies, createTestSecurityDependencies, registerSecurityRoutes } from "./security-routes.js";
import { createPersistentSecurityAuditSink } from "./security-audit.js";
import { createPrismaWalletAuthStore } from "./wallet-auth-store.js";
import { createWebSessionManager } from "./web-session.js";
import { registerInternalAuthBoundary } from "../internal-auth-boundary.js";
import { scopeForRoute } from "./free-access-contract.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the disposable local PostgreSQL suite");
const parsedUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
if (!/^matchpulse_free_access_validation_/.test(databaseName)) throw new Error("database name is outside the disposable validation scope");
if (!( ["localhost", "127.0.0.1", "::1"] as string[]).includes(parsedUrl.hostname)) throw new Error("database host is not loopback");

const clients = new Set<PrismaClient>();
async function createConnectedClient() {
  const client = new PrismaClient();
  clients.add(client);
  await client.$connect();
  return client;
}
async function disconnectAllClients() {
  await Promise.all([...clients].map(async client => { await client.$disconnect(); clients.delete(client); }));
}
async function withIndependentClient<T>(run: (client: PrismaClient) => Promise<T>) {
  const client = await createConnectedClient();
  try { return await run(client); } finally { await client.$disconnect(); clients.delete(client); }
}

let db: PrismaClient;
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const walletAddress = `validation_wallet_${suffix}`;
const auditRoute = `/validation/${suffix}`;
let applicationIds: string[] = [];
let walletId: string | undefined;

async function createApplication(name: string) {
  const wallet = await db.freeAccessWallet.upsert({ where: { walletAddress }, create: { walletAddress }, update: {} });
  walletId = wallet.id;
  const application = await db.freeAccessApplication.create({
    data: { id: `validation_app_${suffix}_${applicationIds.length}`, walletId: wallet.id, name, scopes: ["matches:read"] }
  });
  applicationIds.push(application.id);
  return application;
}

before(async () => {
  db = await createConnectedClient();
  const meta = await db.$queryRawUnsafe<Array<{ database_name: string; host: string; server_version_num: string }>>(
    "SELECT current_database() AS database_name, inet_server_addr()::text AS host, current_setting($$server_version_num$$) AS server_version_num"
  );
  assert.match(meta[0].database_name, /^matchpulse_free_access_validation_/);
  // GitHub Actions runs PostgreSQL in a Docker service container. The client
  // URL remains loopback-scoped, while PostgreSQL reports its private bridge
  // address from inside the container.
  assert.match(meta[0].host, /127\.0\.0\.1|::1|^172\.(?:1[6-9]|2\d|3[01])\./);
  assert.equal(meta[0].server_version_num.slice(0, 2), "16");
});

test("application scope and credential authentication persist across independent clients", async () => {
  const application = await createApplication("credential persistence");
  const credential = await createPrismaApiClientAuth(db).createCredential(application.id, ["matches:read"]);
  assert.ok(credential);
  const token = await createPrismaApiClientAuth(db).issueToken(credential.clientId, credential.clientSecret);
  assert.ok(token);
  await withIndependentClient(async client => {
    const row = await client.freeAccessApplication.findUnique({ where: { id: application.id } });
    assert.deepEqual(row?.scopes, ["matches:read"]);
    assert.equal((await createPrismaApiClientAuth(client).authenticate(token.access_token))?.applicationId, application.id);
  });
});

test("application disable route cascades to credentials and tokens", async () => {
  const previousOrigin = process.env.WEB_ORIGIN;
  process.env.WEB_ORIGIN = "http://localhost:3000";
  const application = await createApplication("route disable");
  const auth = createPrismaApiClientAuth(db);
  const credential = await auth.createCredential(application.id, ["matches:read"]);
  assert.ok(credential);
  const token = await auth.issueToken(credential.clientId, credential.clientSecret);
  assert.ok(token);
  const session = await createWebSessionManager(createPrismaWalletAuthStore(db) as any).create(walletAddress);
  assert.ok(session);
  const app = Fastify();
  registerSecurityRoutes(app, createPrismaSecurityDependencies(db));
  await app.ready();
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/developer/applications/${application.id}/disable`,
      headers: { cookie: `__Host-mp_session=${session.token}`, "x-csrf-token": session.csrf, origin: "http://localhost:3000" }
    });
    assert.equal(response.statusCode, 200);
    await withIndependentClient(async client => {
      assert.equal((await client.freeAccessApplication.findUnique({ where: { id: application.id } }))?.status, "DISABLED");
      assert.equal((await client.freeAccessCredential.count({ where: { applicationId: application.id, revokedAt: { not: null } } })), 1);
      assert.equal((await client.freeAccessToken.count({ where: { applicationId: application.id, revokedAt: { not: null } } })), 1);
      assert.equal(await createPrismaApiClientAuth(client).authenticate(token.access_token), undefined);
    });
  } finally {
    await app.close();
    if (previousOrigin === undefined) delete process.env.WEB_ORIGIN; else process.env.WEB_ORIGIN = previousOrigin;
  }
});

test("independent Prisma clients allow exactly one concurrent challenge consumer", async () => {
  const challengeId = `validation_challenge_valid_${suffix}`;
  const store = createPrismaWalletAuthStore(db) as any;
  await store.putChallenge({ id: challengeId, walletAddress, domain: "localhost", uri: "/verify", chain: "solana:devnet", nonce: `nonce_${suffix}`, issuedAt: Date.now(), requestId: `request_${suffix}`, hash: `hash_${challengeId}`, expiresAt: Date.now() + 300000, attempts: 0, consumed: false });
  const results = await Promise.all(Array.from({ length: 8 }, () => withIndependentClient(client => createPrismaWalletAuthStore(client).verifyAndConsumeChallenge(challengeId, () => true)))) as any[];
  assert.equal(results.filter(result => result?.valid && result.consume).length, 1);
  await withIndependentClient(async client => assert.equal((await createPrismaWalletAuthStore(client).getChallenge(challengeId)).consumed, true));
});

test("invalid challenge attempts persist across independent clients and lock at three", async () => {
  const challengeId = `validation_challenge_invalid_${suffix}`;
  await (createPrismaWalletAuthStore(db) as any).putChallenge({ id: challengeId, walletAddress, domain: "localhost", uri: "/verify", chain: "solana:devnet", nonce: `nonce_${suffix}_invalid`, issuedAt: Date.now(), requestId: `request_${suffix}_invalid`, hash: `hash_${challengeId}`, expiresAt: Date.now() + 300000, attempts: 0, consumed: false });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await withIndependentClient(client => createPrismaWalletAuthStore(client).verifyAndConsumeChallenge(challengeId, () => false)) as any;
    assert.equal(result?.valid, false);
  }
  await withIndependentClient(async client => {
    const store = createPrismaWalletAuthStore(client);
    assert.equal((await store.getChallenge(challengeId)).attempts, 3);
    assert.equal(await store.recordInvalidAttempt(challengeId), undefined);
  });
});

test("daily quota increments atomically across independent clients and reads used=20", async () => {
  const application = await createApplication("quota persistence");
  const results = await Promise.all(Array.from({ length: 20 }, () => withIndependentClient(client => Promise.resolve(createPrismaSecurityDependencies(client).quota.consume(application.id)))));
  assert.equal(results.filter(Boolean).length, 20);
  await withIndependentClient(async client => assert.equal((await createPrismaSecurityDependencies(client).quota.usage(application.id)).used, 20));
});

test("audit event persists with recursive redaction and client boundaries remain isolated", async () => {
  const audit = createPersistentSecurityAuditSink({ create: input => db.freeAccessAuditEvent.create({ data: { ...input, metadata: input.metadata as any } }) });
  await audit.append({ event: "validation_audit", actor: walletAddress, route: auditRoute, success: true, metadata: { nested: { token: "secret-token", safe: "ok" }, list: [{ privateKey: "hidden" }] } });
  const application = await createApplication("credential isolation");
  const auth = createPrismaApiClientAuth(db);
  const credential = await auth.createCredential(application.id, ["matches:read"]);
  assert.ok(credential);
  const token = await auth.issueToken(credential.clientId, credential.clientSecret);
  assert.ok(token);
  const session = await createWebSessionManager(createPrismaWalletAuthStore(db) as any).create(walletAddress);
  assert.ok(session);
  assert.equal(await auth.authenticate(session.token), undefined);
  await withIndependentClient(async client => {
    assert.deepEqual((await client.freeAccessAuditEvent.findFirst({ where: { route: auditRoute } }))?.metadata, { nested: { token: "[REDACTED]", safe: "ok" }, list: [{ privateKey: "[REDACTED]" }] });
    assert.equal(await createWebSessionManager(createPrismaWalletAuthStore(client) as any).get(token.access_token), undefined);
    assert.equal(await createPrismaApiClientAuth(client).authenticate(session.token), undefined);
  });
  assert.equal(scopeForRoute("GET", "/api/internal/health"), undefined);
});

test("external bearer cannot cross the real internal auth boundary", async () => {
  const application = await createApplication("internal boundary");
  const credential = await createPrismaApiClientAuth(db).createCredential(application.id, ["matches:read"]);
  assert.ok(credential);
  const token = await createPrismaApiClientAuth(db).issueToken(credential.clientId, credential.clientSecret);
  assert.ok(token);
  const app = Fastify();
  registerInternalAuthBoundary(app, { env: { MATCHPULSE_INTERNAL_TOKEN: "internal-only-token" } });
  let executed = false;
  app.get("/api/internal/validation", async () => { executed = true; return { ok: true }; });
  await app.ready();
  try {
    const response = await app.inject({ method: "GET", url: "/api/internal/validation", headers: { authorization: `Bearer ${token.access_token}` } });
    assert.ok([401, 403].includes(response.statusCode));
    assert.equal(executed, false);
  } finally { await app.close(); }
});

test("store rejection maps to a generic 503 without leaking the original error", async () => {
  const base = createTestSecurityDependencies();
  const app = Fastify();
  registerSecurityRoutes(app, { ...base, sessions: { ...base.sessions, get: async () => { throw new Error("SQL password and stack must not escape"); } } });
  await app.ready();
  try {
    const response = await app.inject({ method: "GET", url: "/api/auth/session", headers: { cookie: "__Host-mp_session=store-failure" } });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { error: "request_rejected", message: "The request could not be completed." });
    assert.equal(response.body.includes("SQL password"), false);
  } finally { await app.close(); }
});

after(async () => {
  if (!db) return;
  await db.freeAccessToken.deleteMany({ where: { applicationId: { in: applicationIds } } });
  await db.freeAccessCredential.deleteMany({ where: { applicationId: { in: applicationIds } } });
  await db.freeAccessQuota.deleteMany({ where: { applicationId: { in: applicationIds } } });
  await db.freeAccessAuditEvent.deleteMany({ where: { route: auditRoute } });
  await db.freeAccessChallenge.deleteMany({ where: { walletAddress } });
  if (walletId) await db.freeAccessSession.deleteMany({ where: { walletId } });
  await db.freeAccessApplication.deleteMany({ where: { id: { in: applicationIds } } });
  await db.freeAccessWallet.deleteMany({ where: { walletAddress } });
  await disconnectAllClients();
});
