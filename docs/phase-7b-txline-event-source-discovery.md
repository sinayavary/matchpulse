# Phase 7B — TxLINE Event Source Discovery

## Conclusion

No approved TxLINE event source is currently present in the repo.

The current live client supports fixture, score, and odds snapshots only. Event
ingestion remains dependency-injected through Phase 7A. No endpoint was guessed.

## Evidence inspected

| Source | Finding |
| --- | --- |
| `packages/txline-client/src/live.ts` | The live client exposes `getFixtureSnapshot`, `getScoreSnapshot`, and `getOddsSnapshot`. The implemented paths are `/fixtures/snapshot`, `/scores/snapshot/:fixtureId`, and `/odds/snapshot/:fixtureId`. |
| `packages/txline-client/src/index.ts` | The public TxLINE client exports no event-fetch method. |
| `docs/TXLINE_ACCESS_CHECKLIST.md` | The integration guidance lists fixture, score, and odds REST targets plus score/odds updates and streams; it does not specify an event source. |
| `official-txline-examples/devnet/scripts/` | Local examples contain fixture updates and score/odds snapshot, update, and stream examples. No event endpoint or event-fetch helper was found. |
| `apps/api/src/txline-event-ingestion.ts` | `ingestTxlineMatchEvents` accepts `rawEvents` as an input and maps them to stored match-event rows; it does not fetch from TxLINE. |
| `apps/api/src/ingestion-runner.ts` | Event ingestion is supplied through the injected `ingestEvents` dependency. Event summaries contain counts/status fields, not raw payloads. |
| `apps/api/src/product-runtime-refresh-worker.ts` | Worker summaries expose event status/count only and do not fetch TxLINE directly. |

## Missing source contract

There is currently no grounded source file or documentation that establishes all
of the following for TxLINE events:

- endpoint path or existing helper name;
- required input parameters, including whether `asOf` is supported;
- response envelope and raw event row shape; or
- semantics for an empty event response.

The `possibleEvent`/`PossibleEvent` fields observed in score-related local code
are not an approved event source. They are treated as score-payload fields and
are explicitly not used as event ingestion input.

## Safety decision

No live event adapter was added. In particular, this phase does not add or infer
any of the following paths:

- `/events`
- `/events/snapshot`
- `/matches/:fixtureId/events`
- `/fixtures/:fixtureId/events`

No live TxLINE or Telegram calls are made by this change. No public route,
frontend behavior, Prisma schema, migration, worker, scheduler, queue, or
runner dependency-injection behavior is changed.

## Next step to enable an adapter

Obtain or add approved TxLINE documentation or a verified TxLINE client/helper
that specifies the event source path, parameters, response shape, and empty
response semantics. A later phase can then add a mocked, sanitized adapter and
pass its `raw_events` result into `ingestTxlineMatchEvents` through the existing
dependency-injection boundary.

