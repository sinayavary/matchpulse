# Contributing to MatchPulse

Thank you for considering a contribution to MatchPulse.

MatchPulse is an open-source sports-intelligence project. It transforms TxLINE-backed fixture, score, odds, history, and verification inputs into canonical match state and public-safe data-quality or scenario-intelligence outputs. It is not a betting, wagering, payment, or financial-advice product.

## Before You Start

- Open an issue or discussion for substantial changes before implementation.
- Keep changes focused and avoid unrelated refactors.
- Follow the repository-controlled phase and file-scope rules in `AGENTS.md` when they apply.
- Do not change schemas, migrations, public contracts, security boundaries, formulas, thresholds, or phase order without explicit approval.

## Security and Data Boundaries

Never commit or expose:

- JWTs, API tokens, private keys, seed phrases, wallet files, or database credentials
- `.env` files or secret values
- raw proprietary provider payloads or provider-specific weighting
- private model coefficients, formulas, thresholds, training data, or internal confidence calculations
- betting recommendations, stake, payout, profit, expected-value, or trade-execution features

Third-party services and data remain subject to their own licenses and terms. The Apache-2.0 license for this repository does not relicense TxLINE, TxODDS, bookmaker, or other third-party data.

## Development Setup

Prerequisites:

- Node.js 18 or newer
- pnpm 9 or newer
- PostgreSQL when working on database-backed paths
- appropriately configured local credentials only for explicitly approved integration work

Install dependencies:

```powershell
pnpm install
```

Run the relevant package tests and typechecks for your change. Common commands include:

```powershell
pnpm --filter @matchpulse/api test
pnpm --filter @matchpulse/api typecheck
pnpm --filter @matchpulse/web typecheck
pnpm --filter @matchpulse/worker test
pnpm --filter @matchpulse/worker typecheck
```

Use the exact validation commands defined by the active phase pack when repository orchestration is active.

## Pull Requests

A good pull request should:

- explain the problem and the chosen solution
- list the exact files changed
- include the commands run and their results
- state whether database migrations or external network access occurred
- preserve unrelated local work
- avoid secrets, raw provider data, and internal model details
- update documentation when public behavior changes

Do not use force-push workflows that rewrite shared history. Do not merge or activate a follow-on phase unless separately approved.

## Reporting Security Issues

Do not publish credentials or exploitable details in a public issue. Report the minimum necessary information to the repository owner through a private GitHub security-reporting channel when available.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
