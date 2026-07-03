import { z } from "zod";

export const TxlineNetworkSchema = z.enum(["devnet", "mainnet"]);
export type TxlineNetwork = z.infer<typeof TxlineNetworkSchema>;

export type TxlineConfig = {
  network: TxlineNetwork;
  serviceLevelId: number;
  guestJwt?: string;
  apiToken?: string;
  apiOrigin: string;
};

export function getTxlineConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TxlineConfig {
  const network = TxlineNetworkSchema.parse(env.TXLINE_NETWORK ?? "devnet");
  const serviceLevelId = Number(env.TXLINE_SERVICE_LEVEL_ID ?? (network === "mainnet" ? 12 : 1));
  const apiOrigin =
    network === "mainnet"
      ? env.TXLINE_MAINNET_API_ORIGIN ?? "https://txline.txodds.com"
      : env.TXLINE_DEVNET_API_ORIGIN ?? "https://txline-dev.txodds.com";

  return {
    network,
    serviceLevelId,
    apiOrigin,
    guestJwt: env.TXLINE_GUEST_JWT,
    apiToken: env.TXLINE_API_TOKEN
  };
}

export class TxlineClient {
  constructor(private readonly config: TxlineConfig) {}

  get dataHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.guestJwt ?? ""}`,
      "X-Api-Token": this.config.apiToken ?? ""
    };
  }

  get apiBaseUrl(): string {
    return `${this.config.apiOrigin}/api`;
  }

  async getGuestSession(): Promise<{ token: string }> {
    // TODO: implement real call: POST `${apiOrigin}/auth/guest/start`
    throw new Error("TxLINE guest session not implemented yet. See docs/TXLINE_ACCESS_CHECKLIST.md");
  }

  async getFixturesSnapshot(): Promise<unknown> {
    // TODO: implement real call after access token activation.
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
