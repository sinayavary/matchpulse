import { getTxlineConfigFromEnv, toTxlineStatusData } from "./config.js";
import type { TxlineConfig, TxlineDataMode, TxlineNetwork, TxlineStatusData } from "./config.js";
import { TxlineDataModeSchema, TxlineNetworkSchema } from "./config.js";
import type { TxlineCredentials } from "./client.js";
import { TxlineResilientClient } from "./resilient-client.js";

export { getTxlineConfigFromEnv, toTxlineStatusData, TxlineNetworkSchema, TxlineDataModeSchema };
export type { TxlineConfig, TxlineDataMode, TxlineNetwork, TxlineStatusData };
export { TxlineCompleteClient, TxlineClientError, parseTxlineSse } from "./client.js";
export type {
  TxlineClientOptions,
  TxlineCredentials,
  TxlineIntervalParams,
  TxlineRequest,
  TxlineRequestExecutor,
  TxlineScoreStatValidationParams,
  TxlineSseEvent,
  TxlineSseOpener,
} from "./client.js";
export { TxlineResilientClient } from "./resilient-client.js";
export type {
  TxlineGuestJwtRefresher,
  TxlineResilientClientOptions,
  TxlineRetryPolicy,
  TxlineSleeper,
} from "./resilient-client.js";

export class TxlineClient extends TxlineResilientClient {
  constructor(
    config: Pick<TxlineConfig, "apiBaseUrl"> & Partial<Pick<TxlineConfig, "httpTimeoutMs">>,
    credentials: TxlineCredentials = {},
  ) {
    super({
      config: { apiBaseUrl: config.apiBaseUrl, httpTimeoutMs: config.httpTimeoutMs ?? 8000 },
      credentials,
    });
  }

  static fromEnv(credentials?: TxlineCredentials): TxlineClient;
  static fromEnv(env?: NodeJS.ProcessEnv): TxlineClient;
  static fromEnv(source: NodeJS.ProcessEnv | TxlineCredentials = process.env): TxlineClient {
    const isCredentials =
      Object.prototype.hasOwnProperty.call(source, "guestJwt") ||
      Object.prototype.hasOwnProperty.call(source, "apiToken");
    const env = isCredentials ? process.env : source as NodeJS.ProcessEnv;
    const credentials = isCredentials
      ? source as TxlineCredentials
      : { guestJwt: env.TXLINE_GUEST_JWT, apiToken: env.TXLINE_API_TOKEN };
    return new TxlineClient(getTxlineConfigFromEnv(env), credentials);
  }
}

export { createTxlineLiveClient, TxlineLiveError } from "./live.js";
export type { TxlineLiveClientDependencies, TxlineLiveErrorKind, TxlineSafeError } from "./live.js";
export { fetchGuestJwt, sanitizeJwt, TxlineAuthError } from "./auth.js";
export type { FetchGuestJwtOptions } from "./auth.js";
export {
  loadProjectWalletFromEnv,
  resolveProjectWalletPath,
  createTxlineAnchorProgram,
  deriveTxlineSubscribeAccounts,
  buildSubscribeTransaction,
  sendSubscribeTransaction,
  buildActivationMessage,
  signActivationMessage,
  activateApiToken,
  parseSelectedLeagues,
  runActivationPreflight,
  TxlineActivationError,
} from "./activation.js";
export type { TxlineAnchorProgram, TxlineSubscribeAccounts, ActivationPreflightResult } from "./activation.js";
