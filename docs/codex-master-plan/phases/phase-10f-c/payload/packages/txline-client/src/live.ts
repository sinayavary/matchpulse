import { getTxlineConfigFromEnv } from "./config.js";
import {
  TxlineCompleteClient,
  TxlineClientError,
  type TxlineIntervalParams,
  type TxlineRequestExecutor,
  type TxlineScoreStatValidationParams,
  type TxlineSseOpener,
  type TxlineSseEvent,
  type TxlineStreamOptions,
} from "./client.js";
import { createTxlineOddsStreamSupervisor, createTxlineScoreStreamSupervisor, type TxlineBoundSupervisorOptions, type TxlineStreamSupervisor } from "./supervisor.js";

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

async function* wrapStream(endpointHost: string, source: AsyncIterable<TxlineSseEvent>): AsyncGenerator<TxlineSseEvent> {
  try { for await (const event of source) yield event; }
  catch (error) {
    if (error instanceof TxlineClientError) throw new TxlineLiveError({ statusCode: error.statusCode, endpointPath: error.endpointPath, endpointHost, kind: error.kind, message: error.message });
    throw error;
  }
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
    getFixtureUpdates: (params: { epochDay: number; hourOfDay: number }) =>
      wrap(endpointHost, () => client.getFixtureUpdates(params)),
    getFixtureValidation: (params: { fixtureId: string; timestamp?: number }) =>
      wrap(endpointHost, () => client.getFixtureValidation(params)),
    getFixtureBatchValidation: (params: { epochDay: number; hourOfDay: number }) =>
      wrap(endpointHost, () => client.getFixtureBatchValidation(params)),
    getScoreSnapshot: (params: { fixtureId: string; asOf: number }) =>
      wrap(endpointHost, () => client.getScoreSnapshot(params)),
    getScoreUpdates: (params: { fixtureId: string }) =>
      wrap(endpointHost, () => client.getScoreUpdates(params)),
    getScoreHistorical: (params: { fixtureId: string }) =>
      wrap(endpointHost, () => client.getScoreHistorical(params)),
    getScoreIntervalUpdates: (params: TxlineIntervalParams) =>
      wrap(endpointHost, () => client.getScoreIntervalUpdates(params)),
    getScoreStatValidation: (params: TxlineScoreStatValidationParams) =>
      wrap(endpointHost, () => client.getScoreStatValidation(params)),
    getOddsSnapshot: (params: { fixtureId: string; asOf: number }) =>
      wrap(endpointHost, () => client.getOddsSnapshot(params)),
    getOddsUpdates: (params: { fixtureId: string }) =>
      wrap(endpointHost, () => client.getOddsUpdates(params)),
    getOddsIntervalUpdates: (params: TxlineIntervalParams) =>
      wrap(endpointHost, () => client.getOddsIntervalUpdates(params)),
    getOddsValidation: (params: { messageId: string; ts: number }) =>
      wrap(endpointHost, () => client.getOddsValidation(params)),
    streamScores: (options?: TxlineStreamOptions) => wrapStream(endpointHost, client.streamScores(options)),
    streamOdds: (options?: TxlineStreamOptions) => wrapStream(endpointHost, client.streamOdds(options)),
    stream: (endpointPath: string, params: Record<string, string | number> = {}, options?: TxlineStreamOptions) =>
      wrapStream(endpointHost, client.stream(endpointPath, params, options)),
    createScoreStreamSupervisor: (options?: TxlineBoundSupervisorOptions): TxlineStreamSupervisor => createTxlineScoreStreamSupervisor(client, options),
    createOddsStreamSupervisor: (options?: TxlineBoundSupervisorOptions): TxlineStreamSupervisor => createTxlineOddsStreamSupervisor(client, options),
  };
}
