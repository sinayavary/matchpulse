import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTxlineAuditFindingCreateData,
  buildTxlineAuditRunCreateData,
  buildTxlineRawPayloadCreateData
} from "./txline-runtime-payload-store.js";

test("buildTxlineAuditRunCreateData sets safe defaults", () => {
  const startedAt = new Date("2026-07-09T10:00:00.000Z");
  const data = buildTxlineAuditRunCreateData({
    fixtureIds: ["17952170"],
    competitionIds: [430],
    notes: "phase-0a runtime audit",
    startedAt
  });

  assert.equal(data.status, "running");
  assert.equal(data.startedAt, startedAt);
  assert.deepEqual(data.fixtureIds, ["17952170"]);
  assert.deepEqual(data.competitionIds, [430]);
  assert.equal(data.notes, "phase-0a runtime audit");
});

test("buildTxlineRawPayloadCreateData preserves audit metadata", () => {
  const receivedAt = new Date("2026-07-09T10:00:00.000Z");
  const storedAt = new Date("2026-07-09T10:00:01.000Z");
  const providerTs = new Date("2026-07-09T09:59:59.000Z");
  const asOf = new Date("2026-07-09T09:59:58.000Z");
  const data = buildTxlineRawPayloadCreateData({
    auditRunId: "run-1",
    endpointType: "odds_snapshot",
    endpointPath: "/odds/snapshot/17952170",
    fixtureId: "17952170",
    competitionId: "430",
    startEpochDay: 20608,
    asOf,
    providerTs,
    receivedAt,
    storedAt,
    payloadHash: "abc123",
    payloadJson: { foo: "bar" },
    metaJson: { payloadShape: "array" }
  });

  assert.equal(data.auditRunId, "run-1");
  assert.equal(data.endpointType, "odds_snapshot");
  assert.equal(data.endpointPath, "/odds/snapshot/17952170");
  assert.equal(data.fixtureId, "17952170");
  assert.equal(data.competitionId, "430");
  assert.equal(data.startEpochDay, 20608);
  assert.equal(data.asOf, asOf);
  assert.equal(data.providerTs, providerTs);
  assert.equal(data.receivedAt, receivedAt);
  assert.equal(data.storedAt, storedAt);
  assert.equal(data.payloadHash, "abc123");
  assert.deepEqual(data.payloadJson, { foo: "bar" });
  assert.deepEqual(data.metaJson, { payloadShape: "array" });
});

test("buildTxlineAuditFindingCreateData stores details json", () => {
  const data = buildTxlineAuditFindingCreateData({
    auditRunId: "run-1",
    fixtureId: "17952170",
    category: "missing_fields",
    severity: "warning",
    title: "Missing score fields",
    detailsJson: { missingFields: ["possessionType"] }
  });

  assert.equal(data.auditRunId, "run-1");
  assert.equal(data.fixtureId, "17952170");
  assert.equal(data.category, "missing_fields");
  assert.equal(data.severity, "warning");
  assert.equal(data.title, "Missing score fields");
  assert.deepEqual(data.detailsJson, { missingFields: ["possessionType"] });
});
