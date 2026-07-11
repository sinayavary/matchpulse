import axios from "axios";
import { getTxlineConfigFromEnv, type TxlineConfig } from "./config.js";

export type TxlineCredentials = { guestJwt?: string; apiToken?: string };
export type TxlineRequest = { path: string; params?: Record<string, string | number> };
export type TxlineRequestExecutor = (request: TxlineRequest) => Promise<unknown>;
export type TxlineSseEvent = { event: string | null; id: string | null; data: string };
export type TxlineStreamOptions = { signal?: AbortSignal; lastEventId?: string };
export type TxlineSseOpenOptions = { signal?: AbortSignal };
export type TxlineSseOpener = (url: URL, headers: Readonly<Record<string, string>>, options?: TxlineSseOpenOptions) => Promise<AsyncIterable<string>>;
export type TxlineIntervalParams = {
  epochDay: number;
  hourOfDay: number;
  interval: number;
  fixtureId?: string;
};
export type TxlineScoreStatValidationParams =
  | { fixtureId: string; seq: number; statKey: number; statKey2?: number; statKeys?: never }
  | { fixtureId: string; seq: number; statKeys: readonly number[]; statKey?: never; statKey2?: never };
export type TxlineClientOptions = {
  config: Pick<TxlineConfig, "apiBaseUrl" | "httpTimeoutMs">;
  credentials?: TxlineCredentials;
  request?: TxlineRequestExecutor;
  openSse?: TxlineSseOpener;
};

export class TxlineClientError extends Error {
  constructor(
    public readonly kind: "unauthorized" | "forbidden" | "rate_limited" | "server_error" | "timeout" | "network" | "invalid_stream" | "aborted" | "unknown",
    public readonly endpointPath: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "TxlineClientError";
  }
}

function classify(statusCode?: number, code?: string): TxlineClientError["kind"] {
  if (statusCode === 401) return "unauthorized";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 429) return "rate_limited";
  if (statusCode !== undefined && statusCode >= 500) return "server_error";
  if (code === "ECONNABORTED" || code === "ETIMEDOUT") return "timeout";
  if (code) return "network";
  return "unknown";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : typeof error === "object" && error !== null && "name" in error && (error as { name?: unknown }).name === "AbortError";
}

function safeError(error: unknown, path: string): TxlineClientError {
  if (isAbortError(error)) return new TxlineClientError("aborted", path, "The TxLINE request was cancelled.");
  const axiosError = axios.isAxiosError(error)
    ? error as { response?: { status?: number }; code?: string }
    : undefined;
  const statusCode = axiosError?.response?.status;
  const code = axiosError?.code;
  const kind = classify(statusCode, code);
  const messages: Record<TxlineClientError["kind"], string> = {
    unauthorized: "TxLINE rejected the request credentials.",
    forbidden: "TxLINE denied access to the requested resource.",
    rate_limited: "TxLINE rate limited the request.",
    server_error: "TxLINE is temporarily unavailable.",
    timeout: "The TxLINE request timed out.",
    network: "The TxLINE service could not be reached.",
    invalid_stream: "The TxLINE event stream was invalid.",
    aborted: "The TxLINE request was cancelled.",
    unknown: "The TxLINE request failed.",
  };
  return new TxlineClientError(kind, path, messages[kind], statusCode);
}

function credentialHeaders(credentials: TxlineCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${credentials.guestJwt ?? ""}`,
    "X-Api-Token": credentials.apiToken ?? "",
  };
}

async function defaultOpenSse(url: URL, headers: Readonly<Record<string, string>>, options: TxlineSseOpenOptions = {}): Promise<AsyncIterable<string>> {
  let response: Response;
  try { response = await fetch(url, { headers, method: "GET", signal: options.signal }); }
  catch (error) { throw safeError(error, url.pathname); }
  if (!response.ok) {
    throw new TxlineClientError(classify(response.status), url.pathname, "TxLINE rejected the event stream request.", response.status);
  }
  if (response.body === null) {
    throw new TxlineClientError("invalid_stream", url.pathname, "The TxLINE event stream had no body.");
  }
  const decoder = new TextDecoder();
  const body = response.body;
  return {
    async *[Symbol.asyncIterator]() {
      const reader = body.getReader();
      try {
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          yield decoder.decode(item.value, { stream: true });
        }
        const tail = decoder.decode();
        if (tail.length > 0) yield tail;
      } finally {
        if (!options.signal?.aborted) await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    },
  };
}

function parseSseBlock(block: string): TxlineSseEvent | null {
  if (block.trim().length === 0) return null;
  let event: string | null = null;
  let id: string | null = null;
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    const raw = separator < 0 ? "" : line.slice(separator + 1);
    const value = raw.startsWith(" ") ? raw.slice(1) : raw;
    if (field === "event") event = value;
    else if (field === "id") id = value;
    else if (field === "data") data.push(value);
  }
  return data.length > 0 ? { event, id, data: data.join("\n") } : null;
}

function drainSseBuffer(buffer: string): { events: TxlineSseEvent[]; remainder: string } {
  const events: TxlineSseEvent[] = [];
  let remainder = buffer;
  while (true) {
    const boundary = remainder.indexOf("\n\n");
    if (boundary < 0) break;
    const block = remainder.slice(0, boundary);
    remainder = remainder.slice(boundary + 2);
    const parsed = parseSseBlock(block);
    if (parsed !== null) events.push(parsed);
  }
  return { events, remainder };
}

export async function* parseTxlineSse(chunks: AsyncIterable<string>): AsyncGenerator<TxlineSseEvent> {
  let buffer = "";
  let pendingCarriageReturn = false;

  for await (const chunk of chunks) {
    let text: string = pendingCarriageReturn ? `\r${chunk}` : chunk;
    pendingCarriageReturn = text.endsWith("\r");
    if (pendingCarriageReturn) text = text.slice(0, -1);
    buffer += text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const drained = drainSseBuffer(buffer);
    buffer = drained.remainder;
    for (const event of drained.events) yield event;
  }

  if (pendingCarriageReturn) {
    buffer += "\n";
    const drained = drainSseBuffer(buffer);
    buffer = drained.remainder;
    for (const event of drained.events) yield event;
  }

  if (buffer.trim().length > 0) {
    throw new TxlineClientError("invalid_stream", "sse", "The TxLINE event stream ended mid-event.");
  }
}

function intervalPath(domain: "scores" | "odds", params: TxlineIntervalParams): TxlineRequest {
  const query = params.fixtureId === undefined ? undefined : { fixtureId: params.fixtureId };
  return {
    path: `/${domain}/updates/${params.epochDay}/${params.hourOfDay}/${params.interval}`,
    params: query,
  };
}

export class TxlineCompleteClient {
  readonly #config: Pick<TxlineConfig, "apiBaseUrl" | "httpTimeoutMs">;
  readonly #credentials: TxlineCredentials;
  readonly #requestExecutor: TxlineRequestExecutor;
  readonly #openSse: TxlineSseOpener;

  constructor(options: TxlineClientOptions) {
    this.#config = options.config;
    this.#credentials = options.credentials ?? {};
    const http = axios.create({
      baseURL: options.config.apiBaseUrl,
      timeout: options.config.httpTimeoutMs,
      headers: credentialHeaders(this.#credentials),
    });
    this.#requestExecutor = options.request ?? (async ({ path, params }) => {
      try {
        const response = await http.get(path, { params });
        return response.data as unknown;
      } catch (error) {
        throw safeError(error, path);
      }
    });
    this.#openSse = options.openSse ?? defaultOpenSse;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): TxlineCompleteClient {
    const config = getTxlineConfigFromEnv(env);
    return new TxlineCompleteClient({
      config,
      credentials: { guestJwt: env.TXLINE_GUEST_JWT, apiToken: env.TXLINE_API_TOKEN },
    });
  }

  getFixtureSnapshot(params: { competitionId: string; startEpochDay: number }): Promise<unknown> {
    return this.#requestExecutor({ path: "/fixtures/snapshot", params });
  }

  getFixtureUpdates(params: { epochDay: number; hourOfDay: number }): Promise<unknown> {
    return this.#requestExecutor({ path: `/fixtures/updates/${params.epochDay}/${params.hourOfDay}` });
  }

  getFixtureValidation(params: { fixtureId: string; timestamp?: number }): Promise<unknown> {
    return this.#requestExecutor({
      path: "/fixtures/validation",
      params: params.timestamp === undefined
        ? { fixtureId: params.fixtureId }
        : { fixtureId: params.fixtureId, timestamp: params.timestamp },
    });
  }

  getFixtureBatchValidation(params: { epochDay: number; hourOfDay: number }): Promise<unknown> {
    return this.#requestExecutor({ path: "/fixtures/batch-validation", params });
  }

  getScoreSnapshot(params: { fixtureId: string; asOf: number }): Promise<unknown> {
    return this.#requestExecutor({ path: `/scores/snapshot/${encodeURIComponent(params.fixtureId)}`, params: { asOf: params.asOf } });
  }

  getScoreUpdates(params: { fixtureId: string }): Promise<unknown> {
    return this.#requestExecutor({ path: `/scores/updates/${encodeURIComponent(params.fixtureId)}` });
  }

  getScoreHistorical(params: { fixtureId: string }): Promise<unknown> {
    return this.#requestExecutor({ path: `/scores/historical/${encodeURIComponent(params.fixtureId)}` });
  }

  getScoreIntervalUpdates(params: TxlineIntervalParams): Promise<unknown> {
    return this.#requestExecutor(intervalPath("scores", params));
  }

  getScoreStatValidation(params: TxlineScoreStatValidationParams): Promise<unknown> {
    if (params.statKeys !== undefined) {
      return this.#requestExecutor({
        path: "/scores/stat-validation",
        params: { fixtureId: params.fixtureId, seq: params.seq, statKeys: params.statKeys.join(",") },
      });
    }
    return this.#requestExecutor({
      path: "/scores/stat-validation",
      params: params.statKey2 === undefined
        ? { fixtureId: params.fixtureId, seq: params.seq, statKey: params.statKey }
        : { fixtureId: params.fixtureId, seq: params.seq, statKey: params.statKey, statKey2: params.statKey2 },
    });
  }

  getOddsSnapshot(params: { fixtureId: string; asOf: number }): Promise<unknown> {
    return this.#requestExecutor({ path: `/odds/snapshot/${encodeURIComponent(params.fixtureId)}`, params: { asOf: params.asOf } });
  }

  getOddsUpdates(params: { fixtureId: string }): Promise<unknown> {
    return this.#requestExecutor({ path: `/odds/updates/${encodeURIComponent(params.fixtureId)}` });
  }

  getOddsIntervalUpdates(params: TxlineIntervalParams): Promise<unknown> {
    return this.#requestExecutor(intervalPath("odds", params));
  }

  getOddsValidation(params: { messageId: string; ts: number }): Promise<unknown> {
    return this.#requestExecutor({ path: "/odds/validation", params });
  }

  streamScores(options?: TxlineStreamOptions): AsyncGenerator<TxlineSseEvent> {
    return this.stream("scores/stream", {}, options);
  }

  streamOdds(options?: TxlineStreamOptions): AsyncGenerator<TxlineSseEvent> {
    return this.stream("odds/stream", {}, options);
  }

  async *stream(endpointPath: string, params: Record<string, string | number> = {}, options: TxlineStreamOptions = {}): AsyncGenerator<TxlineSseEvent> {
    const url = new URL(endpointPath, `${this.#config.apiBaseUrl.replace(/\/$/, "")}/`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    let chunks: AsyncIterable<string>;
    try {
      const headers = { ...credentialHeaders(this.#credentials) };
      if (options.lastEventId !== undefined && options.lastEventId.length > 0) headers["Last-Event-ID"] = options.lastEventId;
      chunks = await this.#openSse(url, headers, { signal: options.signal });
    } catch (error) {
      if (error instanceof TxlineClientError) throw error;
      throw safeError(error, endpointPath);
    }
    yield* parseTxlineSse(chunks);
  }
}
