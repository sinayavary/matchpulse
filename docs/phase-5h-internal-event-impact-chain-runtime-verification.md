# Phase 5H — Internal Event-Impact Chain Runtime Verification

Date: 2026-07-09

## Environment

- Windows PowerShell, local MatchPulse monorepo.
- API served at `http://localhost:4000` using the existing `apps/api` runtime and local `tsx` binary.
- Verification used stored database-backed data only.
- No UI, frontend files, routes, schema, migrations, Signal records, or Scenario records were changed.

## Fixtures

Checked fixtures `17952170` and `17588223`.

Both fixtures had persisted match data, but neither produced stored event-impact data. Therefore no `event_impact_hint`, `EVENT_IMPACT_ASSESSED`, or event-context pressure signal was available at runtime. Fixture `17952170` did have stored score snapshots and consequently produced the existing public `pressure_hint` when the public card was built; this is separate from event impact.

## Route results

### Agent Presenter

- Default `GET /api/internal/agent/matches/:fixtureId/brief`: passed. The response contained the existing compact brief and internal `signals`, with no `event_impact_hint`, `state`, raw payload, or forbidden property keys.
- Opt-in `?includeEventImpact=true`: passed safe absence behavior for both fixtures. Because stored event-impact data was unavailable, no `event_impact_hint` was emitted. No raw event rows or context were exposed.

### SignalCore

- Default `GET /api/internal/signalcore/matches/:fixtureId`: passed. Existing default signals were returned; no event-impact signal or internal-context path was added.
- Opt-in `?includeInternalContext=true&includeEventImpact=true&includeEventContext=true`: passed safe absence behavior for both fixtures. No `EVENT_IMPACT_ASSESSED` or `PRESSURE_HINT_AVAILABLE` signal was emitted because event-backed context was unavailable. No raw payloads, formulas, debug lineage, predictions, probabilities, or betting fields were observed.

### Public API regression

Both public routes were called with unsafe/internal query parameters enabled:

- `/api/public/matches/:fixtureId/intelligence-card`
- `/api/public/matches/:fixtureId`

Passed. Public responses ignored the internal flags and exposed no `signals`, `event_impact_hint`, `EVENT_IMPACT_ASSESSED`, `state`, `insight`, `context`, or raw payloads. Existing safe public hints remained intact.

## Forbidden-key scan

All six route responses for fixture `17952170` and the corresponding checks for fixture `17588223` were serialized and scanned for the required forbidden property keys. No forbidden property keys were found. Public responses also passed the additional scans for `signals`, `EVENT_IMPACT_ASSESSED`, and `event_impact_hint`.

## Validation commands

- `tsc -p apps/api/tsconfig.typecheck.json --noEmit`: passed.
- `tsx --test apps/api/src/agent-presenter-v0.test.ts`: passed, 49 tests.
- `tsx --test apps/api/src/signalcore-v0.test.ts`: passed, 36 tests.
- `tsx --test apps/api/src/public-api.test.ts`: passed, 42 tests.
- `pnpm.cmd --filter @matchpulse/api test`: blocked before tests by the pnpm ignored-build-script approval gate (`ERR_PNPM_IGNORED_BUILDS`). `pnpm approve-builds` was not run.

## Limitations

The available stored fixtures did not contain event-backed data sufficient to exercise the positive event-impact path. Consequently, this run verifies default behavior, opt-in gating, safe empty behavior, and public isolation, but does not prove a non-empty `event_impact_hint` or `EVENT_IMPACT_ASSESSED` response through the live API.

No live TxLINE call was made.

## Conclusion

Runtime verification found no production bug and required no runtime code change. The available runtime paths preserve default behavior, safely omit unavailable event-impact data, and prevent internal event-impact fields from reaching public routes.

Recommended next core phase: populate or select a controlled stored-event fixture, then repeat the positive-path runtime verification without calling live TxLINE.
