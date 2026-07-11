import { getTxlineConfigFromEnv } from "./config.js";
import {
  TxlineCompleteClient,
  TxlineClientError,
  type TxlineRequestExecutor,
  type TxlineSseOpener,
} from "./client.js";

export type TxlineLiveErrorKind = TxlineClientError["kind"];
export type TxlineSafeError = {
  statusCode?: number;
  endpointPath: string;
  endpointHost: string;
  kind: TxlineLiveErrorKind;
  message: string;
};
export type TxlineLiveClientDependencies = {
  request?: TxlineRequestExecutor;
  openSse?: TxlineSseOpener;
};

export class TxlineLiveError extends Error {
  constructor(public readonly safe: TxlineSafeError) {
    super(safe.message);
    this.name = "TxlineLiveError";
  }
}

function wrap<T>(endpointHost: string, operation: () => Promise<T>): Promise<T> {
  return operation().catch((error: unknown) => {
    if (error instanceof TxlineClientError) {
      throw new TxlineLiveError({
        statusCode: error.statusCode,
        endpointPath: error.endpointPath,
        endpointHost,
        kind: error.kind,
        message: error.message,
      });
    }
    throw error;
  });
}

export function createTxlineLiveClient(
  env: NodeJS.ProcessEnv = process.env,
  dependencies: TxlineLiveClientDependencies = {},
) {
  const config = getTxlineConfigFromEnv(env);
  const client = new TxlineCompleteClient({
    config,
    credentials: { guestJwt: env.TXLINE_GUEST_JWT, apiToken: env.TXLINE_API_TOKEN },
    request: dependencies.request,
    openSse: dependencies.openSse,
  });
  const endpointHost = new URL(config.apiBaseUrl).host;
  return {
    getFixtureSnapshot: (params: { competitionId: string; startEpochDay: number }) =>
      wrap(endpointHost, () => client.getFixtureSnapshot(params)),
    getScoreSnapshot: (params: { fixtureId: string; asOf: number }) =>
      wrap(endpointHost, () => client.getScoreSnapshot(params)),
    getOddsSnapshot: (params: { fixtureId: string; asOf: number }) =>
      wrap(endpointHost, () => client.getOddsSnapshot(params)),
    stream: (endpointPath: string, params: Record<string, string | number> = {}) =>
      client.stream(endpointPath, params),
  };
}
