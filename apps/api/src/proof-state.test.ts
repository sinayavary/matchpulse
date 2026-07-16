import test from "node:test";
import assert from "node:assert/strict";
import { redactProofState, validateProofState } from "./proof-state.js";

test("proof state distinguishes structural availability from on-chain verification", () => {
  const state = validateProofState({ fixture_id: "fixture-1", snapshot_id: "private-snapshot", proof_payload: { root: "abc" }, checked_at: "2026-01-01T00:00:00Z" });
  assert.equal(state.structural_status, "valid"); assert.equal(state.onchain_status, "not_available");
  assert.deepEqual(redactProofState(state), { fixture_id: "fixture-1", availability: "available", structural_status: "valid", onchain_status: "not_available", checked_at: "2026-01-01T00:00:00.000Z" });
});

test("missing and malformed proof payloads are safe degraded states", () => {
  assert.equal(validateProofState({ fixture_id: "f", snapshot_id: "s", checked_at: "2026-01-01" }).availability, "unavailable");
  assert.equal(validateProofState({ fixture_id: "f", snapshot_id: "s", proof_payload: "raw", checked_at: "2026-01-01" }).structural_status, "invalid");
  assert.throws(() => validateProofState({ fixture_id: "f", snapshot_id: "s", proof_payload: { secret: "x" }, checked_at: "bad" }));
});
