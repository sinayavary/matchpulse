import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const INTERNAL_SCOPES = [
  "internal:read",
  "ingestion:write",
  "runtime:audit",
  "provider:operate",
  "system:operate"
] as const;

export type InternalScope = (typeof INTERNAL_SCOPES)[number];
export type ServiceIdentityStatus = "ENABLED" | "DISABLED";

export type ServiceIdentityRecord = {
  id: string;
  status: ServiceIdentityStatus;
};

export type ServiceCredentialRecord = {
  id: string;
  serviceIdentityId: string;
  prefix: string;
  credentialHash: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  scopes: ReadonlyArray<{ scope: string }>;
  serviceIdentity: ServiceIdentityRecord;
};

export type ServiceAuthDecision =
  | { ok: true; credentialId: string; serviceIdentityId: string; scopes: ReadonlyArray<InternalScope> }
  | {
      ok: false;
      reason:
        | "missing_token"
        | "malformed_token"
        | "invalid_token"
        | "unknown_scope"
        | "expired_credential"
        | "revoked_credential"
        | "disabled_identity"
        | "scope_denied";
    };

export type NewServiceCredential = {
  token: string;
  prefix: string;
  credentialHash: string;
  salt: string;
};

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const DIGEST_BYTES = 32;

export function isKnownInternalScope(value: string): value is InternalScope {
  return (INTERNAL_SCOPES as readonly string[]).includes(value);
}

export function validateInternalScopes(scopes: readonly string[]): InternalScope[] {
  const unique = [...new Set(scopes)];
  if (unique.some((scope) => !isKnownInternalScope(scope))) {
    throw new Error("Unknown internal scope.");
  }
  return unique as InternalScope[];
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function hashServiceCredential(secret: string, salt = randomBytes(16)): string {
  if (secret.length < 20) throw new Error("Service credential entropy is insufficient.");
  const digest = scryptSync(secret, salt, DIGEST_BYTES, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION
  });
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${encode(salt)}$${encode(digest)}`;
}

function verifyServiceCredentialHash(secret: string, encodedHash: string): boolean {
  const [algorithm, n, r, p, encodedSalt, encodedDigest] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !encodedSalt || !encodedDigest) return false;
  const salt = decode(encodedSalt);
  const expected = decode(encodedDigest);
  if (salt.length === 0 || expected.length !== DIGEST_BYTES) return false;
  const actual = scryptSync(secret, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  });
  return timingSafeEqual(actual, expected);
}

export function createServiceCredential(prefix = `mp_${encode(randomBytes(5))}`): NewServiceCredential {
  const secret = encode(randomBytes(32));
  const token = `${prefix}.${secret}`;
  const salt = randomBytes(16);
  return { token, prefix, salt: encode(salt), credentialHash: hashServiceCredential(token, salt) };
}

function splitToken(token: string): { prefix: string; secret: string } | null {
  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;
  return { prefix: token.slice(0, separator), secret: token.slice(separator + 1) };
}

export function getServiceCredentialPrefix(token: string): string | null {
  return splitToken(token.trim())?.prefix ?? null;
}

export function authorizeServiceCredential(input: {
  token: string | null | undefined;
  requiredScope?: string;
  credential: ServiceCredentialRecord | null;
  now?: Date;
}): ServiceAuthDecision {
  if (typeof input.token !== "string" || input.token.trim().length === 0) {
    return { ok: false, reason: "missing_token" };
  }
  const parsed = splitToken(input.token.trim());
  if (parsed === null) return { ok: false, reason: "malformed_token" };
  if (input.credential === null || input.credential.prefix !== parsed.prefix) {
    return { ok: false, reason: "invalid_token" };
  }
  if (!verifyServiceCredentialHash(input.token.trim(), input.credential.credentialHash)) {
    return { ok: false, reason: "invalid_token" };
  }
  if (input.credential.serviceIdentity.status !== "ENABLED") {
    return { ok: false, reason: "disabled_identity" };
  }
  const now = input.now ?? new Date();
  if (input.credential.revokedAt !== null) return { ok: false, reason: "revoked_credential" };
  if (input.credential.expiresAt !== null && now.getTime() >= input.credential.expiresAt.getTime()) {
    return { ok: false, reason: "expired_credential" };
  }
  const scopes = input.credential.scopes.map(({ scope }) => scope);
  if (scopes.some((scope) => !isKnownInternalScope(scope))) {
    return { ok: false, reason: "unknown_scope" };
  }
  if (input.requiredScope !== undefined && !scopes.includes(input.requiredScope)) {
    return { ok: false, reason: "scope_denied" };
  }
  return {
    ok: true,
    credentialId: input.credential.id,
    serviceIdentityId: input.credential.serviceIdentityId,
    scopes: scopes as InternalScope[]
  };
}

export function buildAuthAuditEvent(input: {
  eventType: string;
  success: boolean;
  serviceIdentityId?: string;
  credentialId?: string;
  scope?: string;
  method?: string;
  route?: string;
  reason?: string;
  occurredAt?: Date;
}) {
  return {
    eventType: input.eventType,
    success: input.success,
    serviceIdentityId: input.serviceIdentityId ?? null,
    credentialId: input.credentialId ?? null,
    scope: input.scope ?? null,
    method: input.method ?? null,
    route: input.route ?? null,
    reason: input.reason ?? null,
    occurredAt: input.occurredAt ?? new Date()
  };
}
