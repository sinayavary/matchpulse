import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentPresenterBrief } from "./agent-presenter-v0.js";
import { buildEventImpactAssessment } from "./event-impact-foundation.js";
import { buildInternalIntelligenceContext } from "./internal-intelligence-context.js";
import { buildMatchEventContextFromRows } from "./match-event-context-builder.js";
import { buildCanonicalMatchState } from "./match-state-builder.js";
import {
  buildPublicMatchIntelligenceCardResponse,
  type PublicMatchIntelligenceCardResponse
} from "./public-api.js";
import { mapAgentPresenterEventImpactToPublicSummary } from "./public-event-impact-contract.js";
import { buildSignalCoreFromInternalContext, type SignalCoreV0Response } from "./signalcore-v0.js";
import { mapPublicEventImpactToTelegramMessage } from "./telegram-event-impact-contract.js";

const FIXTURE_ID = "phase7c-controlled-event-chain-001";
const NOW = new Date("2026-07-10T12:00:00.000Z");
const SAFE_EVENT_ROW = {
  externalSeq: "1",
  eventType: "red_card",
  eventMinute: 31,
  teamSide: "away",
  title: "Red card",
  description: "Controlled event fixture",
  sourceTimestamp: new Date("2026-07-10T11:31:00.000Z"),
  createdAt: new Date("2026-07-10T11:31:01.000Z")
};

const FORBIDDEN_KEYS = [
  "event_impact_hint", "EVENT_IMPACT_ASSESSED", "signals", "state", "context", "internal_context",
  "insight", "raw", "raw_payload", "debug", "debug_lineage", "formula", "probability", "prediction",
  "confidence", "winner", "recommended_bet", "bet", "expected_value", "EV", "edge", "wager", "stake",
  "profit", "payout", "wallet", "deposit"
].map((key) => key.toLowerCase());

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (value === null || typeof value !== "object") return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key.toLowerCase());
    collectKeys(nested, keys);
  }
  return keys;
}

function assertSafePublicAndTelegramOutputs(
  card: PublicMatchIntelligenceCardResponse,
  telegram: ReturnType<typeof mapPublicEventImpactToTelegramMessage>
): void {
  const keys = [...collectKeys(card), ...collectKeys(telegram)];
  for (const forbidden of FORBIDDEN_KEYS) {
    assert.equal(keys.includes(forbidden), false, `forbidden key exposed: ${forbidden}`);
  }
}

function storedState() {
  return buildCanonicalMatchState({
    fixtureId: FIXTURE_ID,
    fixture: {
      fixtureId: FIXTURE_ID,
      competition: "controlled-competition",
      homeTeam: "Home FC",
      awayTeam: "Away FC",
      startTimeUtc: NOW,
      status: "live"
    },
    scoreboard: {
      homeScore: 1,
      awayScore: 0,
      phase: "second_half",
      lastDataReceivedAt: new Date("2026-07-10T11:59:00.000Z")
    },
    odds: [],
    includeOdds: false,
    builtAt: NOW
  });
}

function unavailableOdds() {
  return {
    status: "unavailable" as const,
    source: "database" as const,
    fixture_id: FIXTURE_ID,
    snapshot_count: 0,
    market_count: 0,
    provider_count: 0,
    latest_timestamp: null,
    limitations: ["No controlled odds fixture was provided."],
    signals: [],
    safe_scope_note: "Stored odds data-quality assessment only."
  };
}

function asSignalCoreResponse(data: ReturnType<typeof buildSignalCoreFromInternalContext>): SignalCoreV0Response {
  return {
    data,
    meta: {
      status: data.summary.status === "ready" ? "live" : data.summary.status === "partial" ? "degraded" : "no_data",
      source: "signalcore",
      mode: "internal"
    }
  };
}

test("controlled stored events flow through public and Telegram-safe contracts", () => {
  const eventContext = buildMatchEventContextFromRows(FIXTURE_ID, [
    SAFE_EVENT_ROW,
    { ...SAFE_EVENT_ROW, externalSeq: "2", eventType: "goal", eventMinute: 47, teamSide: "home" }
  ]);
  assert.equal(eventContext.status, "available");
  assert.equal(eventContext.event_count, 2);
  assert.equal(eventContext.timeline_summary.red_cards, 1);
  assert.equal(eventContext.timeline_summary.goals, 1);

  const impact = buildEventImpactAssessment(eventContext);
  assert.equal(impact.status, "available");
  assert.equal(impact.impact_level, "high");

  const internalContext = buildInternalIntelligenceContext({
    fixtureId: FIXTURE_ID,
    matchState: storedState(),
    oddsReliability: unavailableOdds(),
    eventContext,
    eventImpact: impact,
    now: () => NOW
  });
  const signalCore = buildSignalCoreFromInternalContext(internalContext, { includeEventImpact: true });
  assert.equal(signalCore.signals.some((signal) => signal.type === "EVENT_IMPACT_ASSESSED"), true);

  const presenter = buildAgentPresenterBrief(asSignalCoreResponse(signalCore), { includeEventImpact: true });
  assert.deepEqual(presenter.data.event_impact_hint, {
    status: "available",
    level: "high",
    label: "High stored-event impact",
    key_event_count: 2,
    pressure_level: "high",
    source: "stored_events"
  });
  assert.equal("event_impact_hint" in presenter.data, true);

  const publicSummary = mapAgentPresenterEventImpactToPublicSummary(presenter.data.event_impact_hint);
  assert.equal(publicSummary.status, "available");
  assert.equal(publicSummary.source, "stored_events");
  assert.deepEqual(Object.keys(publicSummary).sort(), [
    "event_count_label", "label", "level", "pressure_label", "safe_scope_note", "source", "status"
  ]);

  const card = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: presenter,
    eventImpactHint: presenter.data.event_impact_hint,
    staleAfterMinutes: 180,
    now: NOW
  });
  assert.ok(card.data);
  assert.equal(card.data.event_impact.status, "available");
  assert.equal("event_impact" in card.data, true);
  assert.equal("event_impact_hint" in card.data, false);

  const telegram = mapPublicEventImpactToTelegramMessage(publicSummary);
  assert.equal(telegram.status, "sendable");
  assert.deepEqual(Object.keys(telegram).sort(), ["body", "safe_scope_note", "severity", "status", "tags", "title"]);
  assertSafePublicAndTelegramOutputs(card, telegram);
});

test("empty stored events produce safe unavailable and silent fallback", () => {
  const emptyContext = buildMatchEventContextFromRows(FIXTURE_ID, []);
  const emptyImpact = buildEventImpactAssessment(emptyContext);
  assert.equal(emptyContext.status, "empty");
  assert.equal(emptyImpact.status, "empty");
  assert.equal(emptyImpact.impact_level, "none");

  const emptyInternalContext = buildInternalIntelligenceContext({
    fixtureId: FIXTURE_ID,
    matchState: buildCanonicalMatchState({ fixtureId: FIXTURE_ID, fixture: null, scoreboard: null, odds: [], builtAt: NOW }),
    oddsReliability: unavailableOdds(),
    eventContext: emptyContext,
    eventImpact: emptyImpact,
    now: () => NOW
  });
  const presenter = buildAgentPresenterBrief(
    asSignalCoreResponse(buildSignalCoreFromInternalContext(emptyInternalContext, { includeEventImpact: true })),
    { includeEventImpact: true }
  );
  assert.equal("event_impact_hint" in presenter.data, false);

  const publicSummary = mapAgentPresenterEventImpactToPublicSummary(undefined);
  assert.equal(publicSummary.status, "unavailable");
  const card = buildPublicMatchIntelligenceCardResponse({
    presenterOutput: presenter,
    eventImpactHint: undefined,
    staleAfterMinutes: 180,
    now: NOW,
    metaStatus: "no_data"
  });
  assert.ok(card.data);
  assert.equal(card.data.event_impact.status, "unavailable");

  const telegram = mapPublicEventImpactToTelegramMessage(publicSummary);
  assert.equal(telegram.status, "silent");
  assertSafePublicAndTelegramOutputs(card, telegram);
});
