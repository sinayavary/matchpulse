import {
  TxlineClientError,
  TxlineCompleteClient,
  type TxlineClientOptions,
  type TxlineCredentials,
  type TxlineIntervalParams,
  type TxlineRequestExecutor,
  type TxlineScoreStatValidationParams,
  type TxlineSseEvent,
  type TxlineSseOpener,
} from "./client.js";
import type { TxlineConfig } from "./config.js";

export type TxlineRetryPolicy = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

export type TxlineGuestJwtRefresher = () => Promise<string>;
export type TxlineSleeper = (delayMs: number) => Promise<void>;

export type TxlineResilientClientOptions = {
  config: Pick<TxlineConfig, "apiBaseUrl" | "httpTimeoutMs">;
  credentials?: TxlineCredentials;
  request?: TxlineRequestExecutor;
  openSse?: TxlineSseOpener;
  retryPolicy?: TxlineRetryPolicy;
  refreshGuestJwt?: TxlineGuestJwtRefresher;
  sleep?: TxlineSleeper;
};

const DEFAULT_POLICY = Object.freeze({
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 2_000,
});

const RETRYABLE = new Set<TxlineClientError["kind"]>([
  "rate_limited",
  "server_error",
  "timeout",
  "network",
]);

function policy(input: TxlineRetryPolicy | undefined): Required<TxlineRetryPolicy> {
  const integer = (value: number | undefined, fallback: number, min: number, max: number): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(value)));
  };
  const maxAttempts = integer(input?.maxAttempts, DEFAULT_POLICY.maxAttempts, 1, 5);
  const baseDelayMs = integer(input?.baseDelayMs, DEFAULT_POLICY.baseDelayMs, 0, 30_000);
  const maxDelayMs = integer(input?.maxDelayMs, DEFAULT_POLICY.maxDelayMs, baseDelayMs, 60_000);
  return { maxAttempts, baseDelayMs, maxDelayMs };
}

function invalid(path: string, message: string): never {
  throw new TxlineClientError("unknown", path, message);
}

function text(value: unknown, field: string, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    return invalid(path, `${field} must be a non-empty string.`);
  }
  return value.trim();
}

function integer(
  value: unknown,
  field: string,
  path: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    return invalid(path, `${field} was outside the supported integer range.`);
  }
  return value;
}

function relativeStreamPath(value: string): string {
  const path = text(value, "endpointPath", "stream");
  if (
    path.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(path) ||
    path.includes("\\") ||
    path.split("/").some((segment) => segment === "..")
  ) {
    return invalid("stream", "The stream endpoint must stay on the configured TxLINE host.");
  }
  return path;
}

function normalizeError(error: unknown, path: string): TxlineClientError {
  if (error instanceof TxlineClientError) return error;
  return new TxlineClientError("unknown", path, "The TxLINE request failed.");
}

export class TxlineResilientClient {
  readonly #config: Pick<TxlineConfig, "apiBaseUrl" | "httpTimeoutMs">;
  #credentials: TxlineCredentials;
  readonly #request?: TxlineRequestExecutor;
  readonly #openSse?: TxlineSseOpener;
  readonly #retry: Required<TxlineRetryPolicy>;
  readonly #refreshGuestJwt?: TxlineGuestJwtRefresher;
  readonly #sleep: TxlineSleeper;

  constructor(options: TxlineResilientClientOptions) {
    this.#config = options.config;
    this.#credentials = { ...options.credentials };
    this.#request = options.request;
    this.#openSse = options.openSse;
    this.#retry = policy(options.retryPolicy);
    this.#refreshGuestJwt = options.refreshGuestJwt;
    this.#sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  #client(): TxlineCompleteClient {
    const options: TxlineClientOptions = {
      config: this.#config,
      credentials: this.#credentials,
      request: this.#request,
      openSse: this.#openSse,
    };
    return new TxlineCompleteClient(options);
  }

  #delay(index: number): number {
    return Math.min(this.#retry.maxDelayMs, this.#retry.baseDelayMs * (2 ** index));
  }

  async #refresh(path: string): Promise<void> {
    if (this.#refreshGuestJwt === undefined) {
      throw new TxlineClientError("unauthorized", path, "TxLINE rejected the request credentials.", 401);
    }
    try {
      const guestJwt = await this.#refreshGuestJwt();
      if (typeof guestJwt !== "string" || guestJwt.trim() === "") throw new Error("empty");
      this.#credentials = { ...this.#credentials, guestJwt: guestJwt.trim() };
    } catch {
      throw new TxlineClientError("unauthorized", path, "TxLINE guest credential refresh failed.", 401);
    }
  }

  async #execute<T>(path: string, operation: (client: TxlineCompleteClient) => Promise<T>): Promise<T> {
    let transientFailures = 0;
    let refreshed = false;
    while (true) {
      try {
        return await operation(this.#client());
      } catch (raw) {
        const error = normalizeError(raw, path);
        if (error.kind === "unauthorized" && !refreshed && this.#refreshGuestJwt !== undefined) {
          refreshed = true;
          await this.#refresh(path);
          continue;
        }
        if (RETRYABLE.has(error.kind) && transientFailures < this.#retry.maxAttempts - 1) {
          const delay = this.#delay(transientFailures);
          transientFailures += 1;
          if (delay > 0) await this.#sleep(delay);
          continue;
        }
        throw error;
      }
    }
  }

  getFixtureSnapshot(params: { competitionId: string; startEpochDay: number }): Promise<unknown> {
    const path = "/fixtures/snapshot";
    const clean = {
      competitionId: text(params.competitionId, "competitionId", path),
      startEpochDay: integer(params.startEpochDay, "startEpochDay", path, 0),
    };
    return this.#execute(path, (client) => client.getFixtureSnapshot(clean));
  }

  getFixtureUpdates(params: { epochDay: number; hourOfDay: number }): Promise<unknown> {
    const path = "/fixtures/updates";
    const clean = {
      epochDay: integer(params.epochDay, "epochDay", path, 0),
      hourOfDay: integer(params.hourOfDay, "hourOfDay", path, 0, 23),
    };
    return this.#execute(path, (client) => client.getFixtureUpdates(clean));
  }

  getFixtureValidation(params: { fixtureId: string; timestamp?: number }): Promise<unknown> {
    const path = "/fixtures/validation";
    const clean = {
      fixtureId: text(params.fixtureId, "fixtureId", path),
      timestamp: params.timestamp === undefined
        ? undefined
        : integer(params.timestamp, "timestamp", path, 0),
    };
    return this.#execute(path, (client) => client.getFixtureValidation(clean));
  }

  getFixtureBatchValidation(params: { epochDay: number; hourOfDay: number }): Promise<unknown> {
    const path = "/fixtures/batch-validation";
    const clean = {
      epochDay: integer(params.epochDay, "epochDay", path, 0),
      hourOfDay: integer(params.hourOfDay, "hourOfDay", path, 0, 23),
    };
    return this.#execute(path, (client) => client.getFixtureBatchValidation(clean));
  }

  getScoreSnapshot(params: { fixtureId: string; asOf: number }): Promise<unknown> {
    const path = "/scores/snapshot";
    const clean = {
      fixtureId: text(params.fixtureId, "fixtureId", path),
      asOf: integer(params.asOf, "asOf", path, 0),
    };
    return this.#execute(path, (client) => client.getScoreSnapshot(clean));
  }

  getScoreUpdates(params: { fixtureId: string }): Promise<unknown> {
    const path = "/scores/updates";
    const clean = { fixtureId: text(params.fixtureId, "fixtureId", path) };
    return this.#execute(path, (client) => client.getScoreUpdates(clean));
  }

  getScoreHistorical(params: { fixtureId: string }): Promise<unknown> {
    const path = "/scores/historical";
    const clean = { fixtureId: text(params.fixtureId, "fixtureId", path) };
    return this.#execute(path, (client) => client.getScoreHistorical(clean));
  }

  getScoreIntervalUpdates(params: TxlineIntervalParams): Promise<unknown> {
    const path = "/scores/updates";
    const clean = {
      epochDay: integer(params.epochDay, "epochDay", path, 0),
      hourOfDay: integer(params.hourOfDay, "hourOfDay", path, 0, 23),
      interval: integer(params.interval, "interval", path, 0, 11),
      fixtureId: params.fixtureId === undefined ? undefined : text(params.fixtureId, "fixtureId", path),
    };
    return this.#execute(path, (client) => client.getScoreIntervalUpdates(clean));
  }

  getScoreStatValidation(params: TxlineScoreStatValidationParams): Promise<unknown> {
    const path = "/scores/stat-validation";
    const fixtureId = text(params.fixtureId, "fixtureId", path);
    const seq = integer(params.seq, "seq", path, 0);
    if (params.statKeys !== undefined) {
      if (params.statKeys.length === 0) return invalid(path, "statKeys must contain at least one key.");
      const clean = {
        fixtureId,
        seq,
        statKeys: params.statKeys.map((key) => integer(key, "statKey", path, 0)),
      };
      return this.#execute(path, (client) => client.getScoreStatValidation(clean));
    }
    const clean = {
      fixtureId,
      seq,
      statKey: integer(params.statKey, "statKey", path, 0),
      statKey2: params.statKey2 === undefined ? undefined : integer(params.statKey2, "statKey2", path, 0),
    };
    return this.#execute(path, (client) => client.getScoreStatValidation(clean));
  }

  getOddsSnapshot(params: { fixtureId: string; asOf: number }): Promise<unknown> {
    const path = "/odds/snapshot";
    const clean = {
      fixtureId: text(params.fixtureId, "fixtureId", path),
      asOf: integer(params.asOf, "asOf", path, 0),
    };
    return this.#execute(path, (client) => client.getOddsSnapshot(clean));
  }

  getOddsUpdates(params: { fixtureId: string }): Promise<unknown> {
    const path = "/odds/updates";
    const clean = { fixtureId: text(params.fixtureId, "fixtureId", path) };
    return this.#execute(path, (client) => client.getOddsUpdates(clean));
  }

  getOddsIntervalUpdates(params: TxlineIntervalParams): Promise<unknown> {
    const path = "/odds/updates";
    const clean = {
      epochDay: integer(params.epochDay, "epochDay", path, 0),
      hourOfDay: integer(params.hourOfDay, "hourOfDay", path, 0, 23),
      interval: integer(params.interval, "interval", path, 0, 11),
      fixtureId: params.fixtureId === undefined ? undefined : text(params.fixtureId, "fixtureId", path),
    };
    return this.#execute(path, (client) => client.getOddsIntervalUpdates(clean));
  }

  getOddsValidation(params: { messageId: string; ts: number }): Promise<unknown> {
    const path = "/odds/validation";
    const clean = {
      messageId: text(params.messageId, "messageId", path),
      ts: integer(params.ts, "ts", path, 0),
    };
    return this.#execute(path, (client) => client.getOddsValidation(clean));
  }

  streamScores(): AsyncGenerator<TxlineSseEvent> {
    return this.stream("scores/stream");
  }

  streamOdds(): AsyncGenerator<TxlineSseEvent> {
    return this.stream("odds/stream");
  }

  async *stream(
    endpointPath: string,
    params: Record<string, string | number> = {},
  ): AsyncGenerator<TxlineSseEvent> {
    const path = relativeStreamPath(endpointPath);
    const query: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (key.trim() === "" || (typeof value === "number" && !Number.isFinite(value))) {
        return invalid(path, "The stream query parameters were invalid.");
      }
      query[key] = value;
    }

    let transientFailures = 0;
    let refreshed = false;
    while (true) {
      let yielded = false;
      try {
        for await (const event of this.#client().stream(path, query)) {
          yielded = true;
          yield event;
        }
        return;
      } catch (raw) {
        const error = normalizeError(raw, path);
        if (yielded) throw error;
        if (error.kind === "unauthorized" && !refreshed && this.#refreshGuestJwt !== undefined) {
          refreshed = true;
          await this.#refresh(path);
          continue;
        }
        if (RETRYABLE.has(error.kind) && transientFailures < this.#retry.maxAttempts - 1) {
          const delay = this.#delay(transientFailures);
          transientFailures += 1;
          if (delay > 0) await this.#sleep(delay);
          continue;
        }
        throw error;
      }
    }
  }
}
