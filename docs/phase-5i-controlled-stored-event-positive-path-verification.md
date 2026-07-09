# Phase 5I - Controlled Stored-Event Positive Path Verification

Date: 2026-07-09

## Environment

- Windows PowerShell in the local MatchPulse monorepo.
- API served locally at `http://localhost:4000` with `apps/api/node_modules/.bin/tsx.CMD src/server.ts`.
- PostgreSQL was accessed through the existing Prisma client and the repository's local `DATABASE_URL` configuration.
- The API product refresh worker was not enabled, so starting the API did not initiate ingestion.
- No UI, frontend, route, Prisma schema, migration, Signal record, or Scenario record was changed.

## Controlled fixture

Fixture ID: `phase5i-controlled-event-positive-001`

The fixture was upserted into the local database with an inline PowerShell/Node command using the existing Prisma client. No verification script was added to the repository.

Controlled stored rows:

- Fixture: competition `Phase 5I Controlled Verification`, stage `runtime-positive-path`, teams `Controlled Home` and `Controlled Away`, status `LIVE`, start time `2026-07-09T11:00:00.000Z`, and no raw payload.
- Match state: minute 70, phase `second_half`, home score 1, away score 0, running true, last data received at `2026-07-09T12:05:00.000Z`, and no raw score or raw odds.
- Match event `phase5i-red-card-001`: `red_card`, minute 65, away side, title `Red card`, source timestamp `2026-07-09T12:00:00.000Z`.
- Match event `phase5i-goal-001`: `goal`, minute 70, home side, title `Goal`, source timestamp `2026-07-09T12:05:00.000Z`.

Both events used the description `Controlled Phase 5I event-impact verification row` and stored no raw payload. No odds rows were inserted because event-impact processing does not require them.

The synthetic fixture remains in the local database as a controlled verification fixture.

## Runtime verification

### SignalCore opt-in

Request:

`GET /api/internal/signalcore/matches/phase5i-controlled-event-positive-001?includeInternalContext=true&includeEventImpact=true&includeEventContext=true`

Result: passed with HTTP 200. The response contained `EVENT_IMPACT_ASSESSED` with compact details only:

- `fixture_id`: `phase5i-controlled-event-positive-001`
- `impact_level`: `high`
- `key_event_count`: 2
- `pressure_level`: `high`

The opt-in response also contained the bounded `PRESSURE_HINT_AVAILABLE` signal from the stored events. It did not expose event rows, internal context, raw data, formulas, debug data, predictions, probabilities, or betting fields.

### Agent Presenter opt-in

Request:

`GET /api/internal/agent/matches/phase5i-controlled-event-positive-001/brief?includeEventImpact=true`

Result: passed with HTTP 200. `data.event_impact_hint` was:

```json
{
  "status": "available",
  "level": "high",
  "label": "High stored-event impact",
  "key_event_count": 2,
  "pressure_level": "high",
  "source": "stored_events"
}
```

The hint contained exactly the six approved compact fields.

### Default internal routes

The default SignalCore and Agent Presenter routes both returned HTTP 200.

- Default SignalCore emitted no `EVENT_IMPACT_ASSESSED` signal and no internal context.
- Default Agent Presenter emitted no `event_impact_hint` and no state or internal context.
- Existing default behavior remained intact. Because the controlled timestamps are earlier than the runtime verification time, the normal default freshness logic reported the stored data as stale; this is unrelated to event-impact gating.

### Public API regression

The public match and intelligence-card routes were called with `includeEventImpact`, `includeInternalContext`, `includeState`, and `includeSignals` all set to true.

Both returned HTTP 200 and ignored the unsafe internal flags. Neither response exposed `signals`, `EVENT_IMPACT_ASSESSED`, `event_impact_hint`, state, context, insight, raw payloads, or any other internal-only field.

## Forbidden-key scan

All six runtime responses were recursively scanned by exact property key for:

`raw`, `raw_payload`, `debug`, `debug_lineage`, `formula`, `context`, `internal_context`, `state`, `insight`, `probability`, `prediction`, `confidence`, `winner`, `recommended_bet`, `bet`, `wager`, `stake`, `expected_value`, `EV`, `edge`, `profit`, `payout`, `wallet`, and `deposit`.

Result: passed with zero hits.

The two public responses were additionally scanned for `signals`, `EVENT_IMPACT_ASSESSED`, and `event_impact_hint`.

Result: passed with zero hits.

## Validation commands

- `node_modules/.bin/tsc.CMD -p apps/api/tsconfig.typecheck.json --noEmit`: passed.
- `apps/api/node_modules/.bin/tsx.CMD --test apps/api/src/agent-presenter-v0.test.ts`: passed, 49/49 tests.
- `apps/api/node_modules/.bin/tsx.CMD --test apps/api/src/signalcore-v0.test.ts`: passed, 36/36 tests.
- `apps/api/node_modules/.bin/tsx.CMD --test apps/api/src/public-api.test.ts`: passed, 42/42 tests.
- `apps/api/node_modules/.bin/tsx.CMD --test apps/api/src/internal-intelligence-context.test.ts`: passed, 10/10 tests.
- `apps/api/node_modules/.bin/tsx.CMD --test apps/api/src/event-impact-foundation.test.ts`: passed, 10/10 tests.
- `apps/api/node_modules/.bin/tsx.CMD --test apps/api/src/match-event-context-builder.test.ts`: passed, 8/8 tests.
- `pnpm.cmd --filter @matchpulse/api test`: ran successfully, 353/353 tests passed. It was not blocked by the ignored-build-script approval gate.

## Runtime changes and data safety

- Runtime code changed: no.
- Verification documentation added: yes, this file.
- Temporary repository script added: no. An inline PowerShell/Node Prisma command was used.
- Live TxLINE calls made: no.
- Secrets, database URLs, and local environment values were not printed or committed.

## Known limitations

- This verifies one deliberately synthetic positive-path fixture in the local database, not a live provider event stream.
- No odds were inserted, so the fixture correctly reports odds as unavailable; odds are outside this event-impact verification.
- The fixed controlled timestamps become stale relative to later runs, affecting only the existing freshness signal and not event-impact classification.
- The controlled fixture was retained locally for repeatable verification.

## Conclusion

The full stored-event positive path is proven at runtime: controlled database events flow through the DB-backed internal intelligence context into SignalCore's compact `EVENT_IMPACT_ASSESSED` signal and Agent Presenter's compact `event_impact_hint`. Default internal behavior remains opt-in, and public isolation remains intact. No production bug or runtime code change was required.

Recommended next core phase: Phase 5J should consolidate these verified internal event-impact outputs into the next explicitly scoped internal consumer or operational workflow while preserving opt-in defaults and public isolation; it should not add a public surface unless separately authorized.
