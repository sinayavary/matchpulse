/**
 * @matchpulse/txline-client
 *
 * Public entrypoint for the TxLINE integration package. Re-exports the
 * env-driven config, the guest JWT fetcher, and the low-level TxlineClient.
 *
 * Secret-handling boundary:
 *   - getTxlineConfigFromEnv() returns a SECRET-FREE object (only booleans
 *     describing whether a credential is configured). It is safe to expose
 *     from status/debug endpoints.
 *   - TxlineClient takes the actual credentials as an explicit constructor
 *     argument. Those never flow through the exposable config object.
 */
import { getTxlineConfigFromEnv, toTxlineStatusData } from "./config.js";
import type { TxlineConfig, TxlineNetwork, TxlineStatusData } from "./config.js";
import { TxlineNetworkSchema } from "./config.js";

export {
  getTxlineConfigFromEnv,
  toTxlineStatusData,
  TxlineNetworkSchema
};
export type { TxlineConfig, TxlineNetwork, TxlineStatusData };

export { fetchGuestJwt, sanitizeJwt, TxlineAuthError } from "./auth.js";
export type { FetchGuestJwtOptions } from "./auth.js";

export {
  getActivationConfigFromEnv,
  buildActivationMessage,
  postActivationRequest,
  TxlineActivationError
} from "./activation.js";
export type { TxlineActivationConfig, ActivationRequestParams } from "./activation.js";

/**
 * Credentials handed to TxlineClient explicitly. These are real secrets and
 * must never be placed in the exposable TxlineConfig object or surfaced by a
 * status endpoint.
 */
export type TxlineCredentials = {
  guestJwt?: string;
  apiToken?: string;
};

/**
 * Low-level TxLINE HTTP client.
 *
 * The non-secret config (origin, base url, network) comes from the env-driven
 * loader; the secrets are supplied separately so the config object itself
 * remains safe to log or return from a status endpoint.
 */
export class TxlineClient {
  constructor(
    private readonly config: Pick<TxlineConfig, "apiBaseUrl" | "apiOrigin" | "network">,
    private readonly credentials: TxlineCredentials = {}
  ) {}

  /** Headers required on every TxLINE data request. */
  get dataHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.guestJwt ?? ""}`,
      "X-Api-Token": this.credentials.apiToken ?? ""
    };
  }

  get apiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  /**
   * Convenience factory: builds a client from the current environment using
   * any configured credentials. Credentials remain optional so a partially
   * configured client can still be constructed for diagnostics.
   */
  static fromEnv(credentials: TxlineCredentials = {}): TxlineClient {
    const config = getTxlineConfigFromEnv();
    return new TxlineClient(
      {
        apiBaseUrl: config.apiBaseUrl,
        apiOrigin: config.apiOrigin,
        network: config.network
      },
      credentials
    );
  }

  async getFixturesSnapshot(): Promise<unknown> {
    // TODO: implement real call once the API token is provisioned.
    throw new Error("TxLINE fixtures snapshot not implemented yet.");
  }

  async getScoresSnapshot(fixtureId: string): Promise<unknown> {
    void fixtureId;
    throw new Error("TxLINE scores snapshot not implemented yet.");
  }

  async getOddsSnapshot(fixtureId: string): Promise<unknown> {
    void fixtureId;
    throw new Error("TxLINE odds snapshot not implemented yet.");
  }
}
