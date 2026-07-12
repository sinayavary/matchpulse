# PowerShell 7 Compatibility Source Pack v1

Authority: ChatGPT-authored exact source installer for PR #15.

Apply only on branch `agent/program-mode-bootstrap-v1` after verifying the branch contains commit `7de25454f98ba88cb784015c8e3ef15d65896c4f`.

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File docs/codex-master-plan/source-packs/powershell7-compat-v1/apply.ps1 -RepoRoot D:\money\matchpulse_governance
```

Then validate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-automation-v2.test.ps1
pnpm.cmd install --offline --frozen-lockfile
pnpm.cmd exec prisma generate
pnpm.cmd typecheck
git diff --check
```

Expected changed implementation paths:

- `scripts/codex-automation-v2.ps1`
- `scripts/codex-automation-v2.test.ps1`
- `.github/workflows/ci.yml`

Do not edit the generated source manually unless the installer stops with `SOURCE_DRIFT`. Do not modify runtime source, payloads, Prisma, migrations, packages, lockfiles, secrets, or environment files. Stage exact paths only, commit as `Apply PowerShell 7 compatibility source`, push the existing PR branch, and stop before merge or Phase 10H-A execution.
