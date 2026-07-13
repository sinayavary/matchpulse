# Phase COMP-A-R1 v1 — Post-Publish Competition Baseline Remediation

## Review status

This is a **review-only, inactive remediation pack**. It must not be activated or executed until the human has reviewed this pack and explicitly approved `COMP-A-R1-v1`.

- Baseline: `0df8ff23e23501c4b67108821d331f937d74887d`
- Remediates: `COMP-A / COMP-A-v1`
- Pack version: `COMP-A-R1-v1`
- Successor after successful remediation review: `COMP-B`
- Scope: exact and closed
- Database/migration: forbidden
- Network access: forbidden
- Public route or DTO change: forbidden

Creating or reviewing this pack does not change `ACTIVE_PHASE.json`, `PHASE_QUEUE.json`, or the state of `COMP-B`.

## Governance findings addressed

The post-publish review identified four bounded defects:

1. target-local specialist renormalization could amplify effective market influence above `approved_model_weight_cap`;
2. `goal_hazard` consumed market probabilities outside the explicit market specialist;
3. the finished-match path forced high confidence and low risk even when terminal data was stale or incomplete;
4. caller-supplied limitation text was copied verbatim into the public-shaped explanation.

No other capability is authorized by this pack.

## Deterministic payload mode

This pack uses one canonical unified diff:

`payload/comp-a-r1.patch`

The result is deterministic because both inputs are locked:

- the exact baseline commit and target Git blob IDs;
- the canonical-LF SHA-256 of the patch.

### Locked baseline target blobs

| Target | Git blob |
| --- | --- |
| `apps/api/src/competition-model-profile.ts` | `10d6d2146f92e19cb77316986b8dd9d4eafcd481` |
| `apps/api/src/competition-model-profile.test.ts` | `2ad12a4539c90ebbedf3eebff38d9e392c045a59` |
| `apps/api/src/prediction-engine-v1.ts` | `45bdcd5fa75fcc69bb9c3efca1b5590cd15ed204` |
| `apps/api/src/prediction-engine-v1.test.ts` | `c3b1de67d21778a36314f614294001115aac14f3` |
| `docs/phase-comp-a-competition-prediction-baseline.md` | `9127751bc9dba27f80da188c20a3998524d07f82` |

A mismatch is `SPEC_CONFLICT`. Do not regenerate or reinterpret the patch.

## Exact application procedure

Only after separate human approval and repository-controlled activation:

1. Run Automation v2 `Validate`.
2. Verify `HEAD` descends from `0df8ff23e23501c4b67108821d331f937d74887d`.
3. Verify each target blob with:

```powershell
git rev-parse "HEAD:<target-path>"
```

4. Verify `payload/comp-a-r1.patch` against `EXPECTED_SHA256.json` using canonical LF normalization.
5. Verify and apply exactly:

```powershell
git apply --check --whitespace=error-all -- `
  docs/codex-master-plan/phases/phase-comp-a-r1/payload/comp-a-r1.patch

git apply --whitespace=error-all -- `
  docs/codex-master-plan/phases/phase-comp-a-r1/payload/comp-a-r1.patch
```

6. Confirm that only the five allowlisted implementation targets changed.
7. Run every validation command in `manifest.json`.
8. Update only the permitted completion metadata in `ACTIVE_PHASE.json`.
9. Run Automation v2 `Prepare`.
10. Stop before Publish and before any successor activation.

## Required remediation behavior

### Global specialist weighting

- Available specialist weights continue to sum to one globally.
- A specialist missing a target output contributes the declared fallback for that target at its own global weight.
- Target-local renormalization must not amplify any specialist.
- The explicit market specialist's effective influence on every target must remain within its assigned weight and the approved odds-intelligence cap.

### Single market-consumption path

- Only the `market` specialist may inject market probability distributions into prediction target composition.
- `goal_hazard`, state, event, scoreline, and fallback specialists must not consume market probabilities.
- Missing or unusable market evidence continues to receive zero market weight.

### Terminal quality

- Finished-match probabilities remain deterministic from the recorded final score.
- Confidence and risk remain sensitive to freshness, minute availability, odds/events coverage, and other declared quality inputs.
- A stale and incomplete terminal state must not be reported as unconditionally high-confidence/low-risk.

### Explanation safety

- Arbitrary caller-supplied limitation strings must not be copied into `explanation.limitations`.
- The explanation may emit only bounded generic statements that internal limitations exist.
- Internal specialist metadata remains internal and is still subject to the future COMP-B public mapper.

## Exact target allowlist

1. `apps/api/src/competition-model-profile.ts`
2. `apps/api/src/competition-model-profile.test.ts`
3. `apps/api/src/prediction-engine-v1.ts`
4. `apps/api/src/prediction-engine-v1.test.ts`
5. `docs/phase-comp-a-competition-prediction-baseline.md`

No package, dependency, route, service, worker, frontend, Prisma, migration, queue, or public-contract file is authorized.

## Validation gate

Completion requires evidence that:

- focused prediction tests pass;
- the full API regression suite passes;
- API typecheck and production build pass;
- the market counterfactual test proves effective influence stays within the cap;
- mixed partial specialist outputs preserve global weights and fallback mass;
- stale/incomplete finished state retains terminal probabilities but degrades confidence/risk;
- arbitrary limitation strings are absent from the public-shaped explanation;
- `git diff --check` passes;
- Prisma/migration diff is empty;
- no database, migration, external service, or production network access occurs;
- no unauthorized target changes;
- `COMP-B` remains inactive.

## Completion boundary

A successful remediation execution ends at:

`PHASE_COMPLETE_PREPARED`

Publish requires a separate explicit human instruction. After publication, a separate governance review must approve the remediation before any COMP-B pack may be activated.
