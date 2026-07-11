import { getTxlineConfigFromEnv, toTxlineStatusData } from "./config.js";
import type { TxlineConfig, TxlineDataMode, TxlineNetwork, TxlineStatusData } from "./config.js";
import { TxlineDataModeSchema, TxlineNetworkSchema } from "./config.js";
import { TxlineCompleteClient, type TxlineCredentials } from "./client.js";

export {
  getTxlineConfigFromEnv,
  toTxlineStatusData,
  TxlineNetworkSchema,
  TxlineDataModeSchema,
};
export type { TxlineConfig, TxlineDataMode, TxlineNetwork, TxlineStatusData };

export {
  TxlineCompleteClient,
  TxlineClientError,
  parseTxlineSse,
} from "./client.js";
export type {
  TxlineClientOptions,
  TxlineCredentials,
  TxlineRequest,
  TxlineRequestExecutor,
  TxlineSseEvent,
  TxlineSseOpener,
} from "./client.js";

export class TxlineClient extends TxlineCompleteClient {
  constructor(
    config: Pick<TxlineConfig, "apiBaseUrl"> & Partial<Pick<TxlineConfig, "httpTimeoutMs">>,
    credentials: TxlineCredentials = {},
  ) {
    super({
      config: {
        apiBaseUrl: config.apiBaseUrl,
        httpTimeoutMs: config.httpTimeoutMs ?? 8000,
      },
      credentials,
    });
  }

  static fromEnv(credentials: TxlineCredentials = {}): TxlineClient {
    const config = getTxlineConfigFromEnv();
    return new TxlineClient(config, credentials);
  }
}

export { createTxlineLiveClient, TxlineLiveError } from "./live.js";
export type { TxlineLiveErrorKind, TxlineSafeError } from "./live.js";

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
export type {
  TxlineAnchorProgram,
  TxlineSubscribeAccounts,
  ActivationPreflightResult,
} from "./activation.js";
