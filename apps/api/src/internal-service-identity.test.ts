import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeServiceCredential,
  buildAuthAuditEvent,
  createServiceCredential,
  hashServiceCredential,
  validateInternalScopes,
  type ServiceCredentialRecord
} from "./internal-service-identity.js";

const created = createServiceCredential("mp_test");
const baseCredential: ServiceCredentialRecord = {
  id: "credential-1",
  serviceIdentityId: "identity-1",
  prefix: created.prefix,
  credentialHash: created.credentialHash,
  expiresAt: new Date("2030-01-01T00:00:00.000Z"),
  revokedAt: null,
  scopes: [{ scope: "internal:read" }, { scope: "runtime:audit" }],
  serviceIdentity: { id: "identity-1", status: "ENABLED" }
};

test("credential creation returns a one-time token and only a hash for persistence", () => {
  assert.notEqual(created.token, created.credentialHash);
  assert.equal(created.credentialHash.includes(created.token), false);
  assert.equal(created.token.startsWith("mp_test."), true);
});

test("valid credential authorizes only declared scope", () => {
  assert.deepEqual(
    authorizeServiceCredential({
      token: created.token,
      credential: baseCredential,
      requiredScope: "runtime:audit",
      now: new Date("2029-01-01T00:00:00.000Z")
    }),
    {
      ok: true,
      credentialId: "credential-1",
      serviceIdentityId: "identity-1",
      scopes: ["internal:read", "runtime:audit"]
    }
  );
  assert.deepEqual(
    authorizeServiceCredential({ token: created.token, credential: baseCredential, requiredScope: "ingestion:write" }),
    { ok: false, reason: "scope_denied" }
  );
});

test("wrong, malformed, missing, expired, revoked, disabled and unknown-scope credentials fail closed", () => {
  assert.deepEqual(authorizeServiceCredential({ token: null, credential: baseCredential }), { ok: false, reason: "missing_token" });
  assert.deepEqual(authorizeServiceCredential({ token: "bad", credential: baseCredential }), { ok: false, reason: "malformed_token" });
  assert.deepEqual(authorizeServiceCredential({ token: "mp_test.wrong_secret_value", credential: baseCredential }), { ok: false, reason: "invalid_token" });
  assert.deepEqual(authorizeServiceCredential({ token: created.token, credential: { ...baseCredential, expiresAt: new Date("2020-01-01") } }), { ok: false, reason: "expired_credential" });
  assert.deepEqual(authorizeServiceCredential({ token: created.token, credential: { ...baseCredential, revokedAt: new Date("2028-01-01") } }), { ok: false, reason: "revoked_credential" });
  assert.deepEqual(authorizeServiceCredential({ token: created.token, credential: { ...baseCredential, serviceIdentity: { ...baseCredential.serviceIdentity, status: "DISABLED" } } }), { ok: false, reason: "disabled_identity" });
  assert.deepEqual(authorizeServiceCredential({ token: created.token, credential: { ...baseCredential, scopes: [{ scope: "unknown:scope" }] } }), { ok: false, reason: "unknown_scope" });
});

test("unknown scopes are rejected and audit records contain no secret material", () => {
  assert.deepEqual(validateInternalScopes(["internal:read", "runtime:audit"]), ["internal:read", "runtime:audit"]);
  assert.throws(() => validateInternalScopes(["admin:*" as never]), /Unknown internal scope/);
  const event = buildAuthAuditEvent({
    eventType: "authentication_failure",
    success: false,
    credentialId: "credential-1",
    method: "GET",
    route: "/api/internal/test",
    reason: "invalid_token"
  });
  const serialized = JSON.stringify(event);
  assert.equal(serialized.includes(created.token), false);
  assert.equal(serialized.includes("authorization"), false);
  assert.equal("token" in event, false);
});

test("hash verification input requires sufficient entropy", () => {
  assert.throws(() => hashServiceCredential("short"), /entropy/);
});
