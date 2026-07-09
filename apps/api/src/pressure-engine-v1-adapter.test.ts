import assert from "node:assert/strict";
import test from "node:test";
import {
  extractScoreRecordsFromStoredPayload,
  getPressureEngineV1FromStoredScores,
  type PressureEngineV1AdapterDependencies,
  type StoredScoreSnapshotPayload
} from "./pressure-engine-v1-adapter.js";

function makePayload(overrides: Partial<StoredScoreSnapshotPayload> = {}): StoredScoreSnapshotPayload {
  return {
    id: "payload-1",
    fixtureId: "17952170",
    endpointType: "scores_snapshot",
    endpointPath: "/scores/snapshot/17952170",
    asOf: new Date("2026-07-09T09:59:58.000Z"),
    providerTs: new Date("2026-07-09T09:59:59.000Z"),
    receivedAt: new Date("2026-07-09T10:00:00.000Z"),
    storedAt: new Date("2026-07-09T10:00:01.000Z"),
    payloadHash: "hash-1",
    payloadJson: [],
    metaJson: { source: "test" },
    ...overrides
  };
}

async function runAdapter(
  fixtureId: string,
  dependencies: PressureEngineV1AdapterDependencies
) {
  return getPressureEngineV1FromStoredScores(fixtureId, undefined, dependencies);
}

test("no payload returns unavailable", async () => {
  const result = await runAdapter("17952170", {
    getLatestScoreSnapshotPayload: async () => null
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.payload.found, false);
  assert.equal(result.payload.extracted_record_count, 0);
  assert.ok(
    result.limitations.some((item) => item.includes("No stored scores_snapshot payload"))
  );
});

test("array payload extracts records and builds pressure", async () => {
  const payload = makePayload({
    payloadJson: [
      { Seq: 1, PossessionType: "AttackPossession" },
      { Seq: 2, PossessionType: "SafePossession" }
    ]
  });

  const result = await runAdapter("17952170", {
    getLatestScoreSnapshotPayload: async () => payload
  });

  assert.equal(result.status, "available");
  assert.equal(result.payload.found, true);
  assert.equal(result.payload.extracted_record_count, 2);
  assert.ok(["available", "limited"].includes(result.pressure.status));
  assert.ok(result.pressure.evidence.some((item) => item.signal === "possessionType"));
});

test("nested data array extraction", () => {
  const records = extractScoreRecordsFromStoredPayload({
    data: [{ Seq: 1, PossessionType: "AttackPossession" }]
  });

  assert.equal(records.length, 1);
});

test("zero score-like records", async () => {
  const result = await runAdapter("17952170", {
    getLatestScoreSnapshotPayload: async () =>
      makePayload({ payloadJson: { hello: "world" } })
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.payload.extracted_record_count, 0);
  assert.ok(
    result.limitations.some((item) => item.includes("did not contain score-like records"))
  );
});

test("dependency error is safe", async () => {
  const result = await runAdapter("17952170", {
    getLatestScoreSnapshotPayload: async () => {
      throw new Error("boom");
    }
  });

  const serialized = JSON.stringify(result).toLowerCase();

  assert.equal(result.status, "error");
  assert.ok(result.limitations.some((item) => item.includes("Failed to read")));
  assert.equal(serialized.includes("stack"), false);
});

test("invalid fixture id returns error", async () => {
  let called = 0;

  const result = await getPressureEngineV1FromStoredScores("   ", undefined, {
    getLatestScoreSnapshotPayload: async () => {
      called += 1;
      return null;
    }
  });

  assert.equal(result.status, "error");
  assert.ok(result.limitations.some((item) => item.includes("Invalid fixture id")));
  assert.equal(called, 0);
});

test("stale payload adds freshness limitation", async () => {
  const staleStoredAt = new Date(Date.now() - 10 * 60_000);
  const result = await getPressureEngineV1FromStoredScores(
    "17952170",
    { maxPayloadAgeMinutes: 5 },
    {
      getLatestScoreSnapshotPayload: async () =>
        makePayload({
          storedAt: staleStoredAt,
          payloadJson: [{ Seq: 1, PossessionType: "AttackPossession" }]
        })
    }
  );

  assert.ok(
    result.limitations.some((item) =>
      item.includes("older than the requested freshness window")
    )
  );
});

test("output has no forbidden property keys", async () => {
  const result = await runAdapter("17952170", {
    getLatestScoreSnapshotPayload: async () =>
      makePayload({
        payloadJson: [{ Seq: 1, PossessionType: "AttackPossession" }]
      })
  });
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

  for (const pattern of forbiddenPropertyPatterns) {
    assert.equal(serialized.includes(pattern), false);
  }
});

test("safe_scope_note exact", async () => {
  const result = await runAdapter("17952170", {
    getLatestScoreSnapshotPayload: async () => null
  });

  assert.equal(
    result.safe_scope_note,
    "This adapter reads stored TxLINE score snapshot payloads and returns a rule-based pressure hint. It does not call live APIs, write data, predict outcomes, produce probabilities, or provide betting guidance."
  );
});
