import { timingSafeEqual } from "node:crypto";

const INTERNAL_TOKEN_ENV = "MATCHPULSE_INTERNAL_TOKEN";
const INTERNAL_HEADER = "x-matchpulse-internal-token";
const AUTHORIZATION_HEADER = "authorization";

export type InternalAuthHeaders = Record<string, string | string[] | undefined>;

export type InternalAuthResult =
  | {
      ok: true;
      configured: true;
      source: typeof INTERNAL_HEADER | "authorization";
    }
  | {
      ok: false;
      configured: boolean;
      reason:
        | "not_configured"
        | "missing_token"
        | "invalid_token"
        | "malformed_authorization";
    };

type ExtractedInternalToken = {
  token: string | null;
  source: typeof INTERNAL_HEADER | "authorization" | null;
  malformed: boolean;
};

function readHeader(headers: InternalAuthHeaders, name: string): string | string[] | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

function readSingleHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") {
    return value[0].trim() || null;
  }
  return null;
}

export function getConfiguredInternalToken(
  env: Record<string, string | undefined> = process.env
): string | null {
  const token = env[INTERNAL_TOKEN_ENV]?.trim();
  return token || null;
}

export function extractInternalTokenFromHeaders(
  headers: InternalAuthHeaders
): ExtractedInternalToken {
  const internalHeader = readHeader(headers, INTERNAL_HEADER);
  const internalToken = readSingleHeaderValue(internalHeader);
  if (internalToken !== null) {
    return { token: internalToken, source: INTERNAL_HEADER, malformed: false };
  }

  const authorization = readHeader(headers, AUTHORIZATION_HEADER);
  const authorizationValue = readSingleHeaderValue(authorization);
  if (authorizationValue === null) {
    return {
      token: null,
      source: authorization === undefined ? null : "authorization",
      malformed: authorization !== undefined
    };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationValue);
  if (!match || !match[1].trim()) {
    return { token: null, source: "authorization", malformed: true };
  }

  return { token: match[1].trim(), source: "authorization", malformed: false };
}

function tokensMatch(expected: string, provided: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export function verifyInternalRouteAuth(input: {
  headers: InternalAuthHeaders;
  env?: Record<string, string | undefined>;
}): InternalAuthResult {
  const expectedToken = getConfiguredInternalToken(input.env);
  if (expectedToken === null) {
    return { ok: false, configured: false, reason: "not_configured" };
  }

  const extracted = extractInternalTokenFromHeaders(input.headers);
  if (extracted.malformed) {
    return { ok: false, configured: true, reason: "malformed_authorization" };
  }
  if (extracted.token === null) {
    return { ok: false, configured: true, reason: "missing_token" };
  }
  if (!tokensMatch(expectedToken, extracted.token)) {
    return { ok: false, configured: true, reason: "invalid_token" };
  }

  return {
    ok: true,
    configured: true,
    source: extracted.source === INTERNAL_HEADER ? INTERNAL_HEADER : "authorization"
  };
}
