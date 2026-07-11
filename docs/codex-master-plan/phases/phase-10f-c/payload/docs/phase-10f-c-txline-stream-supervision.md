# TxLINE stream supervision

## Objective

Provide a backend-only, cancellation-aware supervision layer for existing TxLINE SSE streams.

## Delivered scope

The package adds cancellable transport options, deterministic reconnect handling, bounded catch-up and duplicate suppression, and offline regression tests.

## Public API additions inside the package

`TxlineStreamSupervisor`, its safe snapshot/error/types, fixed constants, and score/odds supervisor factories are exported. Stream methods accept an optional signal and cursor.

## State machine

The supervisor transitions idle → connecting → connected; retryable failures use backing_off, optional catch-up uses catching_up, external cancellation uses stopped, and exhausted/catch-up failure uses failed.

## Fixed reconnect schedule

Reconnect delays are exactly 250ms, 500ms, 1s, 2s, 4s, and 8s. There is no jitter, randomization, or unbounded retry loop.

## Heartbeat and inactivity semantics

Every SSE event proves liveness. Heartbeats must be JSON objects containing a finite non-negative integer `Ts`; invalid heartbeats reconnect without yielding. Inactivity times out after 45 seconds.

## Last-Event-ID semantics

Non-empty IDs become the next cursor, an empty ID clears it, and null leaves it unchanged. A non-empty cursor is sent as `Last-Event-ID` on reconnect.

## Duplicate suppression semantics

Only non-empty IDs participate in a shared FIFO set capped at 2048. Duplicate events are not yielded but still prove liveness; null and empty IDs are never deduplicated.

## Catch-up hook semantics

The optional bounded hook runs only after backoff following a stream failure and before reconnect. Its events use the same validation, cursor, dedupe, and yield path. Hook failure is terminal.

## Cancellation and shutdown

Abort is honored while connecting, reading, waiting, backing off, catching up, and reconnecting. Reader cancellation and lock release are performed without leaking listeners or timers.

## Safe error behavior

Client and live errors expose only the existing safe taxonomy and endpoint metadata. Supervisor terminal errors are sanitized and never include raw provider errors, payloads, secrets, headers, or stack data.

## Security boundaries

No credentials, query secrets, raw errors, or provider payloads appear in snapshots. No real provider, Solana, or database call is made by the package tests.

## Test coverage

Offline deterministic tests cover lifecycle, fixed backoff, reset, catch-up ordering/dedupe, cursor semantics, heartbeat validation/timeout, graceful abort, terminal errors, bounded dedupe, configuration, isolated snapshots, and factories.

## Deferred work

- no persistence
- no checkpoint database
- no worker integration
- no API route
- no public contract
- no frontend
- no live provider smoke test
- no proof structural validation
- no on-chain verification
- no Phase 10G ingestion
- no activation of integration gate `10F`
