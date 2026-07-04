/**
 * TxLINE guest JWT fetcher.
 *
 * The guest JWT is the first step of the TxLINE access flow (see
 * docs/TXLINE_ACCESS_CHECKLIST.md): it authorizes anonymous, rate-limited
 * access that is later upgraded by an on-chain subscription + signed
 * activation message into a full API token.
 *
 * Security rules enforced here:
 *   - The JWT is a secret. It is never logged in full.
 *   - Any diagnostic/preview is capped at the first 8 characters + "...".
 *   - Errors never echo the response body verbatim if it could contain a token.
 */
import { getTxlineConfigFromEnv } from "./config.js";

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Thrown by fetchGuestJwt for every distinguishable failure mode so callers
 * (scripts, endpoints, workers) can render a clean message without leaking the
 * token in the error payload.
 */
export class TxlineAuthError extends Error {
  constructor(
    message: string,
    /** HTTP status if a response was received, else undefined. */
    public readonly status?: number
  ) {
    super(message);
    this.name = "TxlineAuthError";
  }
}

/**
 * Reduces any token-like string to a safe preview: first 8 chars + "...".
 * Used for logs and the CLI script. Never returns enough to reconstruct the
 * token. Empty/undefined input yields a placeholder so logs stay readable.
 */
export function sanitizeJwt(token: string | undefined | null): string {
  if (!token) return "<empty>";
  const trimmed = token.trim();
  if (trimmed.length === 0) return "<empty>";
  const preview = trimmed.slice(0, 8);
  return `${preview}...`;
}

/**
 * Pulls a token out of an arbitrary guest-auth response shape. TxLINE's guest
 * endpoint field name is not documented with certainty, so we accept any of
 * the common variants:
 *   - jwt
 *   - token
 *   - accessToken
 *   - data.jwt
 *   - data.token
 * Returns the first non-empty string match, or null if none is present.
 */
function extractToken(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;

  const root = body as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : {};

  const candidates = [
    root.jwt,
    root.token,
    root.accessToken,
    data.jwt,
    data.token,
    data.accessToken
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

export type FetchGuestJwtOptions = {
  /** Override the guest auth URL (defaults to env-derived config). */
  guestAuthUrl?: string;
  /** Request timeout in ms (default 10000). */
  timeoutMs?: number;
  /** Inject a custom fetch (tests). Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

/**
 * Fetches a TxLINE guest JWT from the configured guest auth endpoint.
 *
 * Failure handling:
 *   - missing TXLINE_GUEST_AUTH_URL -> TxlineAuthError
 *   - network timeout / abort       -> TxlineAuthError
 *   - non-2xx response              -> TxlineAuthError (with status)
 *   - invalid JSON body             -> TxlineAuthError
 *   - JSON missing every known token field -> TxlineAuthError
 *
 * The returned JWT must be treated as a secret by the caller. On success only
 * a sanitized preview is appropriate for logs.
 */
export async function fetchGuestJwt(
  options: FetchGuestJwtOptions = {}
): Promise<string> {
  const config = getTxlineConfigFromEnv();
  const guestAuthUrl = options.guestAuthUrl ?? config.guestAuthUrl;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!guestAuthUrl || guestAuthUrl.trim().length === 0) {
    throw new TxlineAuthError(
      "TXLINE_GUEST_AUTH_URL is not configured. Set it in .env before fetching a guest JWT."
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(guestAuthUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TxlineAuthError(
        `Guest JWT request timed out after ${timeoutMs}ms against ${guestAuthUrl}.`
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new TxlineAuthError(
      `Guest JWT request failed: ${message} (url: ${guestAuthUrl}).`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Intentionally do not include the body: it may contain an inline token
    // or sensitive error detail. Status + url is enough to diagnose.
    throw new TxlineAuthError(
      `Guest JWT request returned HTTP ${response.status} from ${guestAuthUrl}.`,
      response.status
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new TxlineAuthError(
      `Guest JWT response from ${guestAuthUrl} was not valid JSON.`
    );
  }

  const token = extractToken(body);
  if (!token) {
    throw new TxlineAuthError(
      `Guest JWT response from ${guestAuthUrl} did not contain a recognized token field (jwt | token | accessToken | data.jwt | data.token).`
    );
  }

  return token;
}
