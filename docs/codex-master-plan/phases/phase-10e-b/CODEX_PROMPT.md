Work directly inside:

`D:\money\matchpulse_repo`

Execute only Phase 10E-B v1.

Mandatory authority:

1. `AGENTS.md`
2. `docs/codex-master-plan/`
3. `docs/codex-master-plan/phases/phase-10e-b/README.md`
4. `docs/codex-master-plan/phases/phase-10e-b/EXPECTED_SHA256.json`

Required baseline:

`b7c7622a81fcf08fbfe79092367cc98aff4cde6f`

First run:

```powershell
git status --short
git log -1 --format=%H
git diff --quiet -- apps/api/package.json
```

Stop with `SPEC_CONFLICT` if HEAD differs from the required baseline.

Stop with `WORKSPACE_COLLISION` if:

- `apps/api/package.json` has any local change
- any of the five new target files already exists
- an allowed target overlaps unrelated work

Preserve every unrelated local change. Do not reset, clean, stash, restore, checkout, commit, push, migrate, install dependencies, or access the network.

All implementation files are already written under:

`docs/codex-master-plan/phases/phase-10e-b/payload/`

Copy the six payload files to the exact target paths defined in the phase README. Do not rewrite them.

Verify every copied file against `EXPECTED_SHA256.json` using SHA-256. A hash mismatch is `SPEC_CONFLICT`.

Run every validation command from the phase README.

Do not fix unrelated failures. Do not modify an unauthorized file.

Return the exact completion report required by `AGENTS.md`, finish with:

`PHASE_COMPLETE`

Then stop. Do not begin Phase 10E-C.
