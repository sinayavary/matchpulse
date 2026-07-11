import axios from "axios";
import { getTxlineConfigFromEnv, type TxlineConfig } from "./config.js";

export type TxlineCredentials = { guestJwt?: string; apiToken?: string };
export type TxlineRequest = { path: string; params?: Record<string, string | number> };
export type TxlineRequestExecutor = (request: TxlineRequest) => Promise<unknown>;
export type TxlineSseEvent = { event: string | null; id: string | null; data: string };
export type TxlineSseOpener = (url: URL, headers: Readonly<Record<string, string>>) => Promise<AsyncIterable<string>>;
export type TxlineClientOptions = {
  config: Pick<TxlineConfig, "apiBaseUrl" | "httpTimeoutMs">;
  credentials?: TxlineCredentials;
  request?: TxlineRequestExecutor;
  openSse?: TxlineSseOpener;
};

export class TxlineClientError extends Error {
  constructor(
    public readonly kind: "unauthorized" | "forbidden" | "rate_limited" | "server_error" | "timeout" | "network" | "invalid_stream" | "unknown",
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

function safeError(error: unknown, path: string): TxlineClientError {
  const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
  const code = axios.isAxiosError(error) ? error.code : undefined;
  const kind = classify(statusCode, code);
  const messages: Record<TxlineClientError["kind"], string> = {
    unauthorized: "TxLINE rejected the request credentials.",
    forbidden: "TxLINE denied access to the requested resource.",
    rate_limited: "TxLINE rate limited the request.",
    server_error: "TxLINE is temporarily unavailable.",
    timeout: "The TxLINE request timed out.",
    network: "The TxLINE service could not be reached.",
    invalid_stream: "The TxLINE event stream was invalid.",
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

async function defaultOpenSse(url: URL, headers: Readonly<Record<string, string>>): Promise<AsyncIterable<string>> {
  const response = await fetch(url, { headers, method: "GET" });
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
        reader.releaseLock();
      }
    },
  };
}

export async function* parseTxlineSse(chunks: AsyncIterable<string>): AsyncGenerator<TxlineSseEvent> {
  let buffer = "";
  for await (const chunk of chunks) {
    buffer += chunk.replace(/\r\n/g, "\n");
    while (true) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary < 0) break;
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (block.trim().length === 0) continue;
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
      if (data.length > 0) yield { event, id, data: data.join("\n") };
    }
  }
  if (buffer.trim().length > 0) {
    throw new TxlineClientError("invalid_stream", "sse", "The TxLINE event stream ended mid-event.");
  }
}

export class TxlineCompleteClient {
  private readonly credentials: TxlineCredentials;
  private readonly requestExecutor: TxlineRequestExecutor;
  private readonly openSse: TxlineSseOpener;

  constructor(private readonly options: TxlineClientOptions) {
    this.credentials = options.credentials ?? {};
    const http = axios.create({
      baseURL: options.config.apiBaseUrl,
      timeout: options.config.httpTimeoutMs,
      headers: credentialHeaders(this.credentials),
    });
    this.requestExecutor = options.request ?? (async ({ path, params }) => {
      try {
        const response = await http.get(path, { params });
        return response.data as unknown;
      } catch (error) {
        throw safeError(error, path);
      }
    });
    this.openSse = options.openSse ?? defaultOpenSse;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): TxlineCompleteClient {
    const config = getTxlineConfigFromEnv(env);
    return new TxlineCompleteClient({
      config,
      credentials: { guestJwt: env.TXLINE_GUEST_JWT, apiToken: env.TXLINE_API_TOKEN },
    });
  }

  getFixtureSnapshot(params: { competitionId: string; startEpochDay: number }): Promise<unknown> {
    return this.requestExecutor({ path: "/fixtures/snapshot", params });
  }

  getScoreSnapshot(params: { fixtureId: string; asOf: number }): Promise<unknown> {
    return this.requestExecutor({ path: `/scores/snapshot/${encodeURIComponent(params.fixtureId)}`, params: { asOf: params.asOf } });
  }

  getOddsSnapshot(params: { fixtureId: string; asOf: number }): Promise<unknown> {
    return this.requestExecutor({ path: `/odds/snapshot/${encodeURIComponent(params.fixtureId)}`, params: { asOf: params.asOf } });
  }

  async *stream(endpointPath: string, params: Record<string, string | number> = {}): AsyncGenerator<TxlineSseEvent> {
    const url = new URL(endpointPath, `${this.options.config.apiBaseUrl.replace(/\/$/, "")}/`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    let chunks: AsyncIterable<string>;
    try {
      chunks = await this.openSse(url, credentialHeaders(this.credentials));
    } catch (error) {
      if (error instanceof TxlineClientError) throw error;
      throw safeError(error, endpointPath);
    }
    yield* parseTxlineSse(chunks);
  }
}
