import assert from "node:assert/strict";
import test from "node:test";
import {
  FALLBACK_RUNTIME_INGESTION_TARGETS,
  getRuntimeIngestionTargetsFromEnv
} from "./runtime-target-registry.js";

test("missing env returns fallback targets", () => {
  const result = getRuntimeIngestionTargetsFromEnv({});

  assert.deepEqual(result, FALLBACK_RUNTIME_INGESTION_TARGETS);
});

test("valid env returns env targets", () => {
  const result = getRuntimeIngestionTargetsFromEnv({
    MATCHPULSE_RUNTIME_TARGETS_JSON: JSON.stringify({
      fixtures: [{ competitionId: 430, startEpochDay: 20608 }],
      scores: [{ fixtureId: "17952170", asOf: 1_780_596_263_367 }],
      odds: [{ fixtureId: "17588223", asOf: 1_781_226_000_000 }],
      events: [{ fixtureId: "17952170", asOf: 1_780_596_263_367 }]
    })
  });

  assert.deepEqual(result, {
    fixtures: [{ competitionId: 430, startEpochDay: 20608 }],
    scores: [{ fixtureId: "17952170", asOf: 1_780_596_263_367 }],
    odds: [{ fixtureId: "17588223", asOf: 1_781_226_000_000 }],
    events: [{ fixtureId: "17952170", asOf: 1_780_596_263_367 }],
    source: "env"
  });
});

test("invalid JSON falls back safely", () => {
  const result = getRuntimeIngestionTargetsFromEnv({
    MATCHPULSE_RUNTIME_TARGETS_JSON: "{not-json"
  });

  assert.deepEqual(result, FALLBACK_RUNTIME_INGESTION_TARGETS);
});

test("invalid items are skipped", () => {
  const result = getRuntimeIngestionTargetsFromEnv({
    MATCHPULSE_RUNTIME_TARGETS_JSON: JSON.stringify({
      fixtures: [
        { competitionId: 430, startEpochDay: 20608 },
        { competitionId: -1, startEpochDay: 20608 },
        { competitionId: 430, startEpochDay: 0 }
      ],
      scores: [
        { fixtureId: "", asOf: 1_780_596_263_367 },
        { fixtureId: "17952170", asOf: 1_780_596_263_367 }
      ],
      odds: [
        null,
        { fixtureId: "17588223", asOf: -1 },
        { fixtureId: "17588223", asOf: 1_781_226_000_000 }
      ],
      events: [
        { fixtureId: "", asOf: 1_780_596_263_367 },
        { fixtureId: "17952170", asOf: 0 },
        { fixtureId: "17952170" }
      ]
    })
  });

  assert.deepEqual(result, {
    fixtures: [{ competitionId: 430, startEpochDay: 20608 }],
    scores: [{ fixtureId: "17952170", asOf: 1_780_596_263_367 }],
    odds: [{ fixtureId: "17588223", asOf: 1_781_226_000_000 }],
    events: [{ fixtureId: "17952170" }],
    source: "env"
  });
});

test("empty normalized target lists fall back", () => {
  const result = getRuntimeIngestionTargetsFromEnv({
    MATCHPULSE_RUNTIME_TARGETS_JSON: JSON.stringify({
      fixtures: [{ competitionId: -1, startEpochDay: 0 }],
      scores: [{ fixtureId: " ", asOf: -1 }],
      odds: []
    })
  });

  assert.deepEqual(result, FALLBACK_RUNTIME_INGESTION_TARGETS);
});

test("raw json and secrets are not included in normalized output", () => {
  const result = getRuntimeIngestionTargetsFromEnv({
    MATCHPULSE_RUNTIME_TARGETS_JSON: JSON.stringify({
      secret: "top-secret",
      fixtures: [{ competitionId: 430, startEpochDay: 20608 }],
      scores: [{ fixtureId: "17952170", asOf: 1_780_596_263_367 }],
      odds: [{ fixtureId: "17588223", asOf: 1_781_226_000_000 }]
    })
  });
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes("top-secret"), false);
  assert.equal(serialized.includes("MATCHPULSE_RUNTIME_TARGETS_JSON"), false);
  assert.equal(serialized.includes("secret"), false);
});
