import axios from "axios";
import { getTxlineConfigFromEnv } from "./config.js";

export type TxlineLiveErrorKind =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "server_error"
  | "timeout"
  | "network"
  | "unknown";

export type TxlineSafeError = {
  statusCode?: number;
  endpointPath: string;
  endpointHost: string;
  kind: TxlineLiveErrorKind;
  message: string;
};

export class TxlineLiveError extends Error {
  constructor(public readonly safe: TxlineSafeError) {
    super(safe.message);
    this.name = "TxlineLiveError";
  }
}

function classifyError(statusCode?: number, code?: string): TxlineLiveErrorKind {
  if (statusCode === 401) return "unauthorized";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 429) return "rate_limited";
  if (statusCode !== undefined && statusCode >= 500) return "server_error";
  if (statusCode !== undefined) return "unknown";
  if (code === "ECONNABORTED" || code === "ETIMEDOUT") return "timeout";
  if (code) return "network";
  return "unknown";
}

function sanitizeError(error: unknown, endpointPath: string, endpointHost: string): TxlineLiveError {
  const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
  const code = axios.isAxiosError(error) ? error.code : undefined;
  const kind = classifyError(statusCode, code);
  const messages: Record<TxlineLiveErrorKind, string> = {
    unauthorized: "TxLINE rejected the request credentials.",
    forbidden: "TxLINE denied access to the requested resource.",
    rate_limited: "TxLINE rate limited the request.",
    server_error: "TxLINE is temporarily unavailable.",
    timeout: "The TxLINE request timed out.",
    network: "The TxLINE service could not be reached.",
    unknown: "The TxLINE request failed."
  };
  return new TxlineLiveError({ statusCode, endpointPath, endpointHost, kind, message: messages[kind] });
}

export function createTxlineLiveClient(env: NodeJS.ProcessEnv = process.env) {
  const config = getTxlineConfigFromEnv(env);
  const endpointHost = new URL(config.apiBaseUrl).host;
  const client = axios.create({
    baseURL: config.apiBaseUrl,
    timeout: config.httpTimeoutMs,
    headers: {
      Authorization: `Bearer ${env.TXLINE_GUEST_JWT ?? ""}`,
      "X-Api-Token": env.TXLINE_API_TOKEN ?? ""
    }
  });

  async function get(endpointPath: string, params: Record<string, string | number>): Promise<unknown> {
    try {
      const result = await client.get(endpointPath, { params });
      return result.data as unknown;
    } catch (error) {
      throw sanitizeError(error, endpointPath, endpointHost);
    }
  }

  return {
    getFixtureSnapshot: (params: { competitionId: string; startEpochDay: number }) =>
      get("/fixtures/snapshot", params),
    getScoreSnapshot: (params: { fixtureId: string; asOf: number }) =>
      get(`/scores/snapshot/${encodeURIComponent(params.fixtureId)}`, { asOf: params.asOf }),
    getOddsSnapshot: (params: { fixtureId: string; asOf: number }) =>
      get(`/odds/snapshot/${encodeURIComponent(params.fixtureId)}`, { asOf: params.asOf })
  };
}
