export type ProofState = {
  fixture_id: string;
  snapshot_id: string;
  availability: "available" | "unavailable";
  structural_status: "valid" | "invalid" | "unavailable";
  onchain_status: "not_available" | "not_verified";
  checked_at: string;
};

export type PublicProofState = Omit<ProofState, "snapshot_id">;

function text(value: unknown, name: string): string { if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be non-empty.`); return value.trim(); }
function iso(value: unknown): string { const source = text(value, "checked_at"); const timestamp = Date.parse(source); if (!Number.isFinite(timestamp)) throw new TypeError("checked_at must be an ISO timestamp."); return new Date(timestamp).toISOString(); }

export function validateProofState(input: { fixture_id: unknown; snapshot_id: unknown; proof_payload?: unknown; checked_at: unknown }): ProofState {
  const fixtureId = text(input.fixture_id, "fixture_id"); const snapshotId = text(input.snapshot_id, "snapshot_id"); const checkedAt = iso(input.checked_at);
  const available = input.proof_payload !== undefined && input.proof_payload !== null;
  const structurallyValid = available && typeof input.proof_payload === "object";
  return { fixture_id: fixtureId, snapshot_id: snapshotId, availability: available ? "available" : "unavailable", structural_status: available ? structurallyValid ? "valid" : "invalid" : "unavailable", onchain_status: "not_available", checked_at: checkedAt };
}

export function redactProofState(state: ProofState): PublicProofState {
  const { snapshot_id: _privateSnapshotId, ...publicState } = state;
  return publicState;
}
