/**
 * TxLINE on-chain activation support.
 *
 * The full TxLINE access flow (see docs/TXLINE_ACCESS_CHECKLIST.md):
 *   1. Guest JWT          — implemented in auth.ts
 *   2. On-chain subscribe — create a subscription transaction on Solana
 *   3. Signed message      — sign an activation payload with the wallet
 *   4. Activation POST     — exchange the signed payload for an API token
 *   5. Authenticated API   — use both JWT + API token on every request
 *
 * Steps 2-4 are scaffolded here. Several on-chain details depend on TxLINE's
 * program IDL and activation endpoint spec that have not yet been captured in
 * the project docs. getActivationConfigFromEnv() reports exactly which fields
 * are missing so the operator knows what to fill in before running activation.
 *
 * Security:
 *   - No secret is logged or returned by status endpoints.
 *   - The activation config reports only field presence, never values.
 */

import { sanitizeJwt } from "./auth.js";
import { getTxlineConfigFromEnv } from "./config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Subset of the on-chain / activation parameters required to perform a
 * TxLINE subscription activation. Fields that are present carry their value;
 * fields that are absent must be obtained from TxLINE documentation before
 * activation can proceed.
 */
export type TxlineActivationConfig = {
  /** Solana on-chain program ID for TxLINE subscribe instruction. */
  programId?: string;
  /** TxL SPL token mint address used in the subscription. */
  txlTokenMint?: string;
  /** Subscription duration in weeks. */
  durationWeeks?: number;
  /** Comma-separated league IDs or empty string for all. */
  selectedLeagues: string;
  /** List of field names that are still missing. */
  missingFields: string[];
};

/**
 * Parameters supplied to the activation endpoint POST request.
 * All fields are known values at call-time — no secrets from env leak here.
 */
export type ActivationRequestParams = {
  apiBaseUrl: string;
  guestJwt: string;
  txSignature: string;
  walletSignatureBase64: string;
  walletPublicKey: string;
  selectedLeagues: string;
  /** Override the activation URL (for tests). */
  activationUrl?: string;
  /** Override fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
};

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class TxlineActivationError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "TxlineActivationError";
  }
}

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

function isPresent(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Reads TxLINE activation-related env vars and returns a typed config object
 * together with a list of field names whose values are still missing.
 *
 * Recognised env vars (all optional — missing ones are reported in `missingFields`):
 *   TXLINE_PROGRAM_ID        — Solana program ID for subscribe instruction
 *   TXLINE_TXL_TOKEN_MINT     — TxL token mint address
 *   TXLINE_DURATION_WEEKS     — subscription duration in weeks
 *   TXLINE_SELECTED_LEAGUES   — league filter (empty = all)
 *
 * The returned config is safe to log — it carries only a boolean-style
 * `missingFields` list, never the raw secret values.
 */
export function getActivationConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): TxlineActivationConfig {
  const missingFields: string[] = [];

  const programId = env.TXLINE_PROGRAM_ID?.trim();
  if (!programId) missingFields.push("TXLINE_PROGRAM_ID");

  const txlTokenMint = env.TXLINE_TXL_TOKEN_MINT?.trim();
  if (!txlTokenMint) missingFields.push("TXLINE_TXL_TOKEN_MINT");

  const durationWeeksRaw = env.TXLINE_DURATION_WEEKS?.trim();
  const durationWeeks = durationWeeksRaw ? Number(durationWeeksRaw) : undefined;
  if (!durationWeeksRaw || Number.isNaN(durationWeeks)) {
    missingFields.push("TXLINE_DURATION_WEEKS");
  }

  const selectedLeagues = env.TXLINE_SELECTED_LEAGUES?.trim() ?? "";

  return {
    programId,
    txlTokenMint,
    durationWeeks,
    selectedLeagues,
    missingFields
  };
}

// ---------------------------------------------------------------------------
// Activation message builder (placeholder)
// ---------------------------------------------------------------------------

/**
 * Builds the message that the wallet must sign for the activation request.
 *
 * **IMPORTANT:** The exact format of this message is unconfirmed. It is a
 * best-effort scaffold that must be verified against TxLINE's activation
 * documentation once available. The structure below follows the conceptual
 * flow in TXLINE_ACCESS_CHECKLIST.md but may need adjustment.
 */
export function buildActivationMessage(
  txSignature: string,
  selectedLeagues: string,
  guestJwt: string
): Uint8Array {
  // Sanitize JWT in the message — we only need the payload, not a full copy.
  const jwtPreview = sanitizeJwt(guestJwt);
  const raw = `${txSignature}:${selectedLeagues}:${jwtPreview}`;
  return new TextEncoder().encode(raw);
}

// ---------------------------------------------------------------------------
// Activation endpoint POST
// ---------------------------------------------------------------------------

/**
 * Pulls the API token from an activation response. Mirrors the flexible
 * field-name guessing in auth.ts since the exact response shape is unconfirmed.
 */
function extractActivationToken(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;

  const root = body as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : {};

  const candidates = [
    root.apiToken,
    root.api_token,
    root.token,
    root.accessToken,
    root.access_token,
    data.apiToken,
    data.api_token,
    data.token,
    data.accessToken,
    data.access_token
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

/**
 * POSTs the signed activation payload to the TxLINE activation endpoint.
 *
 * The default activation URL is `${apiBaseUrl}/token/activate` — this matches
 * the convention in the project docs but is **unconfirmed** and may need to
 * change once the official TxLINE API spec is available.
 *
 * On success the raw API token string is returned so the caller (script)
 * can decide what to do with it. It is NOT saved or logged by this function.
 */
export async function postActivationRequest(
  params: ActivationRequestParams
): Promise<string> {
  const activationUrl =
    params.activationUrl ?? `${params.apiBaseUrl}/token/activate`;
  const fetchImpl = params.fetchImpl ?? fetch;

  const body = {
    txSignature: params.txSignature,
    walletSignature: params.walletSignatureBase64,
    walletPublicKey: params.walletPublicKey,
    selectedLeagues: params.selectedLeagues
  };

  let response: Response;
  try {
    response = await fetchImpl(activationUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.guestJwt}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TxlineActivationError(
      `Activation request failed: ${message} (url: ${activationUrl}).`
    );
  }

  if (!response.ok) {
    throw new TxlineActivationError(
      `Activation request returned HTTP ${response.status} from ${activationUrl}.`,
      response.status
    );
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new TxlineActivationError(
      `Activation response from ${activationUrl} was not valid JSON.`
    );
  }

  const token = extractActivationToken(responseBody);
  if (!token) {
    throw new TxlineActivationError(
      `Activation response from ${activationUrl} did not contain a recognized API token field.`
    );
  }

  return token;
}
