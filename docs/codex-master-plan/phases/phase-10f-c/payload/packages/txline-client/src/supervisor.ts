import type { TxlineCompleteClient, TxlineSseEvent } from "./client.js";

export const TXLINE_RECONNECT_DELAYS_MS = [250, 500, 1000, 2000, 4000, 8000] as const;
export const TXLINE_HEARTBEAT_TIMEOUT_MS = 45_000;
export const TXLINE_DEDUPE_CAPACITY = 2_048;

export type TxlineReconnectReason = "stream_error" | "stream_ended" | "heartbeat_timeout" | "invalid_heartbeat";
export type TxlineSupervisorStatus = "idle" | "connecting" | "connected" | "backing_off" | "catching_up" | "stopped" | "failed";
export type TxlineStreamSupervisorSnapshot = {
  status: TxlineSupervisorStatus; reconnectAttempt: number; lastEventId: string | null;
  lastEventReceivedAtMs: number | null; lastHeartbeatAtMs: number | null;
  lastHeartbeatProviderTs: number | null; lastFailureReason: TxlineReconnectReason | null;
};
export type TxlineStreamFactoryContext = { signal: AbortSignal; lastEventId: string | null };
export type TxlineStreamFactory = (context: TxlineStreamFactoryContext) => AsyncIterable<TxlineSseEvent> | Promise<AsyncIterable<TxlineSseEvent>>;
export type TxlineCatchUpContext = { signal: AbortSignal; reason: TxlineReconnectReason; lastEventId: string | null; lastEventReceivedAtMs: number | null };
export type TxlineCatchUp = (context: TxlineCatchUpContext) => Promise<readonly TxlineSseEvent[]>;
export type TxlineSleep = (delayMs: number, signal: AbortSignal) => Promise<void>;
export type TxlineNextOutcome = { kind: "event"; result: IteratorResult<TxlineSseEvent> } | { kind: "timeout" };
export type TxlineNextWithTimeout = (iterator: AsyncIterator<TxlineSseEvent>, timeoutMs: number, signal: AbortSignal) => Promise<TxlineNextOutcome>;
export type TxlineStreamSupervisorOptions = {
  openStream: TxlineStreamFactory; catchUp?: TxlineCatchUp; reconnectDelaysMs?: readonly number[];
  heartbeatTimeoutMs?: number; dedupeCapacity?: number; now?: () => number; sleep?: TxlineSleep;
  nextWithTimeout?: TxlineNextWithTimeout; onStateChange?: (snapshot: Readonly<TxlineStreamSupervisorSnapshot>) => void;
};
export type TxlineStreamSupervisorErrorKind = "reconnect_exhausted" | "catch_up_failed";
export class TxlineStreamSupervisorError extends Error {
  constructor(readonly kind: TxlineStreamSupervisorErrorKind, readonly reconnectAttempts: number, readonly lastReason: TxlineReconnectReason | null) {
    super(kind === "catch_up_failed" ? "TxLINE stream catch-up failed." : "TxLINE stream reconnect attempts were exhausted.");
    this.name = "TxlineStreamSupervisorError";
  }
}

const abortError = () => new DOMException("The operation was aborted.", "AbortError");
const isAbort = (error: unknown) => typeof error === "object" && error !== null && "name" in error && (error as { name?: unknown }).name === "AbortError";
const defaultSleep: TxlineSleep = (delay, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(abortError());
  const timer = setTimeout(done, delay);
  const abort = () => { clearTimeout(timer); done(abortError()); };
  function done(error?: unknown) { signal.removeEventListener("abort", abort); error === undefined ? resolve() : reject(error); }
  signal.addEventListener("abort", abort, { once: true });
});
const defaultNextWithTimeout: TxlineNextWithTimeout = (iterator, timeoutMs, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(abortError());
  const timer = setTimeout(() => finish({ kind: "timeout" }), timeoutMs);
  const abort = () => finish(undefined, abortError());
  function finish(value?: TxlineNextOutcome, error?: unknown) { clearTimeout(timer); signal.removeEventListener("abort", abort); error === undefined ? resolve(value!) : reject(error); }
  signal.addEventListener("abort", abort, { once: true });
  iterator.next().then(result => finish({ kind: "event", result }), error => finish(undefined, error));
});

export class TxlineStreamSupervisor {
  readonly #openStream: TxlineStreamFactory; readonly #catchUp?: TxlineCatchUp; readonly #delays: readonly number[];
  readonly #timeout: number; readonly #capacity: number; readonly #now: () => number; readonly #sleep: TxlineSleep;
  readonly #next: TxlineNextWithTimeout; readonly #onStateChange?: TxlineStreamSupervisorOptions["onStateChange"];
  #state: TxlineStreamSupervisorSnapshot = { status: "idle", reconnectAttempt: 0, lastEventId: null, lastEventReceivedAtMs: null, lastHeartbeatAtMs: null, lastHeartbeatProviderTs: null, lastFailureReason: null };
  #ids = new Set<string>(); #fifo: string[] = [];
  constructor(options: TxlineStreamSupervisorOptions) {
    const delays = options.reconnectDelaysMs ?? TXLINE_RECONNECT_DELAYS_MS;
    const timeout = options.heartbeatTimeoutMs ?? TXLINE_HEARTBEAT_TIMEOUT_MS;
    const capacity = options.dedupeCapacity ?? TXLINE_DEDUPE_CAPACITY;
    if (!Array.isArray(delays) || delays.length === 0 || delays.some(v => !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) || !Number.isFinite(timeout) || timeout <= 0 || !Number.isInteger(timeout) || !Number.isFinite(capacity) || capacity <= 0 || !Number.isInteger(capacity)) throw new TypeError("Invalid TxLINE stream supervisor configuration.");
    this.#openStream = options.openStream; this.#catchUp = options.catchUp; this.#delays = [...delays]; this.#timeout = timeout; this.#capacity = capacity;
    this.#now = options.now ?? Date.now; this.#sleep = options.sleep ?? defaultSleep; this.#next = options.nextWithTimeout ?? defaultNextWithTimeout; this.#onStateChange = options.onStateChange;
  }
  getSnapshot(): Readonly<TxlineStreamSupervisorSnapshot> { return { ...this.#state }; }
  #transition(status: TxlineSupervisorStatus, patch: Partial<TxlineStreamSupervisorSnapshot> = {}) { this.#state = { ...this.#state, ...patch, status }; this.#onStateChange?.({ ...this.#state }); }
  #process(event: TxlineSseEvent): TxlineSseEvent | null {
    const received = this.#now(); this.#state = { ...this.#state, lastEventReceivedAtMs: received };
    if (event.event === "heartbeat") { let value: unknown; try { value = JSON.parse(event.data); } catch { throw "invalid_heartbeat"; }
      if (typeof value !== "object" || value === null || !Number.isFinite((value as { Ts?: unknown }).Ts) || !Number.isInteger((value as { Ts: number }).Ts) || (value as { Ts: number }).Ts < 0) throw "invalid_heartbeat";
      this.#state = { ...this.#state, lastHeartbeatAtMs: received, lastHeartbeatProviderTs: (value as { Ts: number }).Ts };
    }
    if (event.id !== null) this.#state = { ...this.#state, lastEventId: event.id === "" ? null : event.id };
    if (event.id !== null && event.id.length > 0) { if (this.#ids.has(event.id)) return null; this.#ids.add(event.id); this.#fifo.push(event.id); if (this.#fifo.length > this.#capacity) this.#ids.delete(this.#fifo.shift()!); }
    return event;
  }
  async *run(external?: AbortSignal): AsyncGenerator<TxlineSseEvent> {
    let active: AbortController | undefined; const abort = () => active?.abort(); external?.addEventListener("abort", abort, { once: true });
    let reason: TxlineReconnectReason | null = null;
    try { while (!external?.aborted) {
      const controller = active = new AbortController();
      this.#transition("connecting"); let iterator: AsyncIterator<TxlineSseEvent> | undefined;
      try { iterator = (await this.#openStream({ signal: controller.signal, lastEventId: this.#state.lastEventId }))[Symbol.asyncIterator](); this.#transition("connected");
        while (!controller.signal.aborted) { const outcome = await this.#next(iterator, this.#timeout, controller.signal); if (outcome.kind === "timeout") { reason = "heartbeat_timeout"; break; } if (outcome.result.done) { reason = "stream_ended"; break; }
          try { const event = this.#process(outcome.result.value); this.#state = { ...this.#state, reconnectAttempt: 0, lastFailureReason: null }; if (event) yield event; }
          catch (value) { if (value === "invalid_heartbeat") { reason = "invalid_heartbeat"; break; } throw value; }
        }
      } catch (error) { if (isAbort(error) || controller.signal.aborted) break; reason = "stream_error"; }
      finally { controller.abort(); await iterator?.return?.().catch(() => undefined); }
      if (external?.aborted) break;
      const attempts = this.#state.reconnectAttempt; if (attempts >= this.#delays.length) { this.#transition("failed", { lastFailureReason: reason }); throw new TxlineStreamSupervisorError("reconnect_exhausted", attempts, reason); }
      this.#transition("backing_off", { reconnectAttempt: attempts + 1, lastFailureReason: reason });
      const nextController = active = new AbortController(); const propagate = () => nextController.abort(); external?.addEventListener("abort", propagate, { once: true });
      try { await this.#sleep(this.#delays[attempts]!, nextController.signal); } catch (error) { if (!isAbort(error)) throw error; } finally { external?.removeEventListener("abort", propagate); }
      if (external?.aborted) break;
      if (this.#catchUp && reason) { this.#transition("catching_up"); try { for (const event of await this.#catchUp({ signal: nextController.signal, reason, lastEventId: this.#state.lastEventId, lastEventReceivedAtMs: this.#state.lastEventReceivedAtMs })) { const processed = this.#process(event); this.#state = { ...this.#state, reconnectAttempt: 0, lastFailureReason: null }; if (processed) yield processed; } } catch { this.#transition("failed", { lastFailureReason: reason }); throw new TxlineStreamSupervisorError("catch_up_failed", this.#state.reconnectAttempt, reason); } }
    } } finally { external?.removeEventListener("abort", abort); active?.abort(); if (this.#state.status !== "failed") this.#transition("stopped"); }
  }
}
export type TxlineBoundSupervisorOptions = Omit<TxlineStreamSupervisorOptions, "openStream">;
export function createTxlineScoreStreamSupervisor(client: Pick<TxlineCompleteClient, "streamScores">, options: TxlineBoundSupervisorOptions = {}): TxlineStreamSupervisor { return new TxlineStreamSupervisor({ ...options, openStream: ({ signal, lastEventId }) => client.streamScores({ signal, lastEventId: lastEventId ?? undefined }) }); }
export function createTxlineOddsStreamSupervisor(client: Pick<TxlineCompleteClient, "streamOdds">, options: TxlineBoundSupervisorOptions = {}): TxlineStreamSupervisor { return new TxlineStreamSupervisor({ ...options, openStream: ({ signal, lastEventId }) => client.streamOdds({ signal, lastEventId: lastEventId ?? undefined }) }); }
