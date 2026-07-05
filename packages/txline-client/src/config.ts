/**
 * TxLINE configuration.
 *
 * All values come exclusively from environment variables — nothing is
 * hardcoded, and no secret is ever materialized here. The returned object is
 * safe to expose from status/debug endpoints because it only carries booleans
 * describing whether a secret is *configured*, never the secret itself.
 *
 * Network rules (see docs/TXLINE_ACCESS_CHECKLIST.md): devnet and mainnet must
 * never be mixed. The selected network drives the default api origin so a
 * devnet JWT can never be silently used against a mainnet host (or vice versa).
 */
import { z } from "zod";

export const TxlineNetworkSchema = z.enum(["devnet", "mainnet"]);
export type TxlineNetwork = z.infer<typeof TxlineNetworkSchema>;
export const TxlineDataModeSchema = z.enum(["mock", "live", "auto"]);
export type TxlineDataMode = z.infer<typeof TxlineDataModeSchema>;

const DEFAULT_DEVNET_ORIGIN = "https://txline-dev.txodds.com";
const DEFAULT_MAINNET_ORIGIN = "https://txline.txodds.com";
const DEFAULT_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

/**
 * Full TxLINE config. Fields marked "configured" are booleans that describe
 * presence only — the underlying secret is intentionally NOT included.
 */
export type TxlineConfig = {
  network: TxlineNetwork;
  serviceLevelId: number;
  apiOrigin: string;
  apiBaseUrl: string;
  guestAuthUrl: string;
  rpcUrl: string;
  solanaKeypairPath: string;
  guestJwtConfigured: boolean;
  apiTokenConfigured: boolean;
  dataMode: TxlineDataMode;
  httpTimeoutMs: number;
  defaultCompetitionId?: string;
  defaultStartEpochDay?: number;
};

function isPresent(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Loads and validates TxLINE config from the environment.
 *
 * Accepts both naming conventions used during the project's evolution:
 *   - new:  TXLINE_API_ORIGIN / TXLINE_API_BASE_URL / TXLINE_GUEST_AUTH_URL
 *   - legacy network-specific: TXLINE_DEVNET_API_ORIGIN / TXLINE_MAINNET_API_ORIGIN
 *
 * `apiBaseUrl` defaults to `${apiOrigin}/api`, matching TXLINE_ACCESS_CHECKLIST.md.
 *
 * @param env Environment source (defaults to process.env) — injected for tests.
 */
export function getTxlineConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): TxlineConfig {
  const network = TxlineNetworkSchema.parse(env.TXLINE_NETWORK ?? "devnet");
  const serviceLevelId = Number(
    env.TXLINE_SERVICE_LEVEL_ID ?? (network === "mainnet" ? 12 : 1)
  );

  // Origin: prefer the unified var, fall back to network-specific, then to a
  // network-aware hardcoded default. This guarantees devnet stays devnet.
  const legacyOrigin =
    network === "mainnet"
      ? env.TXLINE_MAINNET_API_ORIGIN
      : env.TXLINE_DEVNET_API_ORIGIN;
  const apiOrigin =
    env.TXLINE_API_ORIGIN ?? legacyOrigin ??
    (network === "mainnet" ? DEFAULT_MAINNET_ORIGIN : DEFAULT_DEVNET_ORIGIN);

  const apiBaseUrl = env.TXLINE_API_BASE_URL ?? `${apiOrigin}/api`;

  const guestAuthUrl =
    env.TXLINE_GUEST_AUTH_URL ?? `${apiOrigin}/auth/guest/start`;

  const rpcUrl =
    env.TXLINE_RPC_URL ??
    (network === "mainnet" ? DEFAULT_MAINNET_RPC_URL : DEFAULT_DEVNET_RPC_URL);

  const solanaKeypairPath = env.SOLANA_KEYPAIR_PATH ?? "";
  const dataMode = TxlineDataModeSchema.parse(env.TXLINE_DATA_MODE ?? "mock");
  const parsedTimeout = Number(env.TXLINE_HTTP_TIMEOUT_MS ?? 8000);
  const httpTimeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : 8000;
  const defaultCompetitionId = isPresent(env.TXLINE_DEFAULT_COMPETITION_ID)
    ? env.TXLINE_DEFAULT_COMPETITION_ID!.trim()
    : undefined;
  const parsedStartEpochDay = isPresent(env.TXLINE_DEFAULT_START_EPOCH_DAY)
    ? Number(env.TXLINE_DEFAULT_START_EPOCH_DAY)
    : undefined;
  const defaultStartEpochDay = parsedStartEpochDay !== undefined && Number.isFinite(parsedStartEpochDay)
    ? parsedStartEpochDay
    : undefined;

  return {
    network,
    serviceLevelId,
    apiOrigin,
    apiBaseUrl,
    guestAuthUrl,
    rpcUrl,
    solanaKeypairPath,
    guestJwtConfigured: isPresent(env.TXLINE_GUEST_JWT),
    apiTokenConfigured: isPresent(env.TXLINE_API_TOKEN),
    dataMode,
    httpTimeoutMs,
    defaultCompetitionId,
    defaultStartEpochDay
  };
}

/**
 * Project status payload surfaced by the backend's internal status endpoint.
 * Mirrors TxlineConfig minus any secret-bearing field. This is the shape that
 * is safe to return to the operator/dashboard — never extend it to carry a
 * raw JWT, API token, private key, or seed phrase.
 */
export type TxlineStatusData = {
  api_base_url_configured: boolean;
  guest_jwt_configured: boolean;
  api_token_configured: boolean;
  data_mode: TxlineDataMode;
  timeout_ms: number;
};

/**
 * Projects a full config into a secret-free status object suitable for the
 * internal status endpoint. Booleans only — no secret strings leak through.
 */
export function toTxlineStatusData(config: TxlineConfig): TxlineStatusData {
  return {
    api_base_url_configured: isPresent(config.apiBaseUrl),
    guest_jwt_configured: config.guestJwtConfigured,
    api_token_configured: config.apiTokenConfigured,
    data_mode: config.dataMode,
    timeout_ms: config.httpTimeoutMs
  };
}
