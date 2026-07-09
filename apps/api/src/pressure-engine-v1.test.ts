import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPressureEngineV1Hint,
  normalizePressureEngineV1Options,
  type PressureEngineV1Evidence
} from "./pressure-engine-v1.js";

function makeScoreRecord(overrides: Record<string, unknown> = {}) {
  return {
    Seq: 1,
    Ts: 1_781_226_000_000,
    FixtureId: "17952170",
    GameState: "LIVE",
    ...overrides
  };
}

function evidenceSignals(evidence: PressureEngineV1Evidence[]): string[] {
  return evidence.map((item) => item.signal);
}

test("empty input returns unavailable", () => {
  const result = buildPressureEngineV1Hint([]);

  assert.equal(result.status, "unavailable");
  assert.equal(result.pressure_level, "none");
  assert.equal(result.pressure_score, 0);
  assert.equal(result.evaluated_records, 0);
  assert.equal(result.usable_records, 0);
});

test("possessionType weights are applied", () => {
  const result = buildPressureEngineV1Hint([
    makeScoreRecord({ Seq: 1, PossessionType: "SafePossession" }),
    makeScoreRecord({ Seq: 2, PossessionType: "AttackPossession" }),
    makeScoreRecord({ Seq: 3, PossessionType: "DangerPossession" }),
    makeScoreRecord({ Seq: 4, PossessionType: "HighDangerPossession" })
  ]);

  assert.equal(result.pressure_score > 0, true);
  assert.equal(["medium", "high"].includes(result.pressure_level), true);
  assert.ok(result.evidence.some((item) => item.signal === "possessionType"));
  assert.ok(evidenceSignals(result.evidence).every((signal) => signal === "possessionType"));
});

test("missing possessionType is not treated as neutral pressure", () => {
  const result = buildPressureEngineV1Hint([
    makeScoreRecord({ Seq: 10 }),
    makeScoreRecord({ Seq: 11, GameState: "LIVE" })
  ]);

  assert.equal(result.evidence.length, 0);
  assert.ok(result.limitations.some((item) => item.includes("possessionType is sparse and treated as a discrete state flag")));
  assert.ok(["unavailable", "limited"].includes(result.status));
});

test("possession field without possessionType is weak hint", () => {
  const result = buildPressureEngineV1Hint([
    makeScoreRecord({ Seq: 1, Possession: "home" })
  ]);

  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].weight, 0.5);
  assert.equal(result.pressure_level, "low");
  assert.ok(result.evidence[0].reason.includes("weak availability hint"));
});

test("possibleEvent is ignored", () => {
  const result = buildPressureEngineV1Hint([
    makeScoreRecord({ Seq: 1, PossibleEvent: { goal: true } })
  ]);

  assert.equal(result.evidence.some((item) => item.signal === "possibleEvent"), false);
  assert.ok(result.limitations.some((item) => item.includes("possibleEvent is not used by Pressure Engine v1")));
});

test("records are sorted by seq", () => {
  const result = buildPressureEngineV1Hint([
    makeScoreRecord({ Seq: 5, PossessionType: "AttackPossession" }),
    makeScoreRecord({ Seq: 1, PossessionType: "SafePossession" }),
    makeScoreRecord({ Seq: 3, PossessionType: "DangerPossession" })
  ]);

  assert.equal(result.latest_seq, 5);
  assert.deepEqual(result.debug_lineage.map((item) => item.seq), [1, 3, 5]);
  assert.deepEqual(result.evidence.map((item) => item.seq), [1, 3, 5]);
});

test("windowSize limits evaluated records", () => {
  const records = Array.from({ length: 20 }, (_, index) =>
    makeScoreRecord({
      Seq: index + 1,
      Ts: 1_781_226_000_000 + index,
      PossessionType: "SafePossession"
    })
  );
  const result = buildPressureEngineV1Hint(records, { windowSize: 5 });

  assert.equal(result.evaluated_records, 5);
});

test("output does not include forbidden keys", () => {
  const result = buildPressureEngineV1Hint([
    makeScoreRecord({ Seq: 1, PossessionType: "AttackPossession" })
  ]);
  const serialized = JSON.stringify(result).toLowerCase();
  const forbiddenPropertyPatterns = [
    '"confidence":',
    '"probability":',
    '"recommendation":',
    '"recommended_bet":',
    '"bet":',
    '"wager":',
    '"stake":',
    '"expected_value":',
    '"edge":',
    '"prediction":',
    '"winner":'
  ];

  forbiddenPropertyPatterns.forEach((pattern) => {
    assert.equal(serialized.includes(pattern), false);
  });
});

test("safe_scope_note is present", () => {
  const result = buildPressureEngineV1Hint([
    makeScoreRecord({ Seq: 1, PossessionType: "AttackPossession" })
  ]);

  assert.equal(
    result.safe_scope_note,
    "This output is a rule-based pressure hint from available TxLINE score fields. It is not a prediction, probability, betting recommendation, or trained model output."
  );
});

test("normalizePressureEngineV1Options clamps values", () => {
  const normalized = normalizePressureEngineV1Options({ windowSize: 999, maxEvidence: 0 });

  assert.equal(normalized.windowSize, 50);
  assert.equal(normalized.maxEvidence, 1);
});
