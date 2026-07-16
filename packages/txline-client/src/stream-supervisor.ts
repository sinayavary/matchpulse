import type { TxlineClientError, TxlineSseEvent } from "./client.js";

export type StreamCheckpoint = {
  streamKind: "scores" | "odds";
  lastSseId: string | null;
  providerTimestamp: number | null;
  sequence: number | null;
  heartbeatAt: number | null;
  status: "idle" | "connecting" | "connected" | "reconnecting" | "stopped" | "failed";
  reconnectCount: number;
  lastErrorCategory: TxlineClientError["kind"] | null;
  updatedAt: number;
};

export type StreamSupervisorOptions = {
  streamKind: "scores" | "odds";
  open: (lastEventId: string | null, signal: AbortSignal) => AsyncIterable<TxlineSseEvent>;
  onEvent: (event: TxlineSseEvent) => Promise<void> | void;
  checkpoint?: StreamCheckpoint;
  now?: () => number;
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
  maxReconnects?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  heartbeatTimeoutMs?: number;
};

export function createStreamCheckpoint(streamKind: StreamCheckpoint["streamKind"], now = Date.now()): StreamCheckpoint {
  return { streamKind, lastSseId: null, providerTimestamp: null, sequence: null, heartbeatAt: null,
    status: "idle", reconnectCount: 0, lastErrorCategory: null, updatedAt: now };
}

function errorKind(error: unknown): StreamCheckpoint["lastErrorCategory"] {
  return error && typeof error === "object" && "kind" in error && typeof error.kind === "string"
    ? error.kind as StreamCheckpoint["lastErrorCategory"] : "unknown";
}

export class TxlineStreamSupervisor {
  readonly #options: Required<Pick<StreamSupervisorOptions, "now" | "random" | "maxReconnects" | "baseDelayMs" | "maxDelayMs" | "heartbeatTimeoutMs">> & StreamSupervisorOptions;
  readonly #abort = new AbortController();
  #checkpoint: StreamCheckpoint;
  readonly #seen = new Set<string>();

  constructor(options: StreamSupervisorOptions) {
    this.#options = { ...options, now: options.now ?? Date.now, random: options.random ?? Math.random,
      maxReconnects: options.maxReconnects ?? 5, baseDelayMs: options.baseDelayMs ?? 250,
      maxDelayMs: options.maxDelayMs ?? 10_000, heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 60_000 };
    this.#checkpoint = options.checkpoint ? { ...options.checkpoint } : createStreamCheckpoint(options.streamKind, this.#options.now());
  }

  get checkpoint(): StreamCheckpoint { return { ...this.#checkpoint }; }
  stop(): void { this.#abort.abort(); this.#checkpoint = { ...this.#checkpoint, status: "stopped", updatedAt: this.#options.now() }; }

  async run(): Promise<StreamCheckpoint> {
    while (!this.#abort.signal.aborted && this.#checkpoint.reconnectCount <= this.#options.maxReconnects) {
      this.#checkpoint = { ...this.#checkpoint, status: this.#checkpoint.reconnectCount ? "reconnecting" : "connecting", updatedAt: this.#options.now() };
      try {
        this.#checkpoint = { ...this.#checkpoint, status: "connected", heartbeatAt: this.#options.now(), updatedAt: this.#options.now() };
        const iterator = this.#options.open(this.#checkpoint.lastSseId, this.#abort.signal)[Symbol.asyncIterator]();
        while (true) {
          if (this.#abort.signal.aborted) break;
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const heartbeat = new Promise<IteratorResult<TxlineSseEvent>>((_, reject) => {
              timer = setTimeout(() => reject(new Error("heartbeat timeout")), this.#options.heartbeatTimeoutMs);
            });
            const next = await Promise.race([iterator.next(), heartbeat]);
            if (next.done) break;
            const event = next.value;
            const id = event.id ?? `${event.event ?? "message"}:${event.data}`;
            if (this.#seen.has(id)) continue;
            this.#seen.add(id);
            if (this.#seen.size > 2048) this.#seen.delete(this.#seen.values().next().value as string);
            const providerTimestamp = event.event === "heartbeat" ? this.#options.now() : this.#checkpoint.providerTimestamp;
            this.#checkpoint = { ...this.#checkpoint, lastSseId: event.id ?? this.#checkpoint.lastSseId,
              providerTimestamp, heartbeatAt: this.#options.now(), status: "connected", updatedAt: this.#options.now() };
            await this.#options.onEvent(event);
          } finally {
            if (timer !== undefined) clearTimeout(timer);
          }
        }
        if (this.#abort.signal.aborted) break;
        throw new Error("stream ended");
      } catch (error) {
        if (this.#abort.signal.aborted) break;
        this.#checkpoint = { ...this.#checkpoint, status: "reconnecting", reconnectCount: this.#checkpoint.reconnectCount + 1,
          lastErrorCategory: errorKind(error), updatedAt: this.#options.now() };
        if (this.#checkpoint.reconnectCount > this.#options.maxReconnects) {
          this.#checkpoint = { ...this.#checkpoint, status: "failed", updatedAt: this.#options.now() };
          break;
        }
        const exponent = Math.min(this.#options.maxDelayMs, this.#options.baseDelayMs * 2 ** (this.#checkpoint.reconnectCount - 1));
        const delay = Math.floor(exponent * (0.5 + this.#options.random()));
        await (this.#options.sleep ?? ((ms, signal) => new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, ms); signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true });
        })))(delay, this.#abort.signal);
      }
    }
    return this.checkpoint;
  }
}
