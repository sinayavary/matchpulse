# MatchPulse Program Decision Record — 2026-07-11

> Status: review-only architecture decision record. This is not legal advice, provider approval, phase activation, network permission, migration permission, deployment authorization, or release approval.

## 1. Decision summary

The user-supplied program form is accepted as planning input, with the production-safe corrections recorded in `PROGRAM_DECISIONS_RESOLVED.json`.

The normalized program keeps the product mission unchanged: an informational live football scenario-intelligence service with deterministic evidence, replayable evaluation, public-safe outputs, bilingual accessibility, and no betting or trading capability.

## 2. Accepted decisions

- `aggressive_gated` autonomy remains the target operating mode.
- Production is the final target release.
- Persian and English are required, with Persian default and full RTL/LTR parity.
- The product is mobile-first and targets WCAG 2.2 AA.
- PostgreSQL 16, containers, separate inference service, GitHub Actions, EU data residency, structured observability, zero critical/high security findings, and a pre-production penetration test are retained.
- Telegram is the only launch notification channel and remains opt-in.
- Production migrations, real network access, secrets, paid accounts, and final release remain human-gated.

## 3. Modified decisions

### 3.1 Schedule

A complete production launch in 16 weeks is not used as the governing commitment for this scope.

The planning schedule is:

- Week 8: internal alpha
- Week 12: reproducible MVP demo
- Week 18: private beta
- Week 24: public beta
- Week 28: production GA

Week 16 remains only a stretch target for a constrained beta when provider access, legal review, infrastructure, and evaluation data arrive early.

### 3.2 Budget

The original USD 60–90k range is treated as an MVP/private-beta envelope, not a complete production budget.

Planning envelopes are:

- MVP/private beta: USD 80–120k
- Production GA: USD 120–200k
- Monthly operations: USD 4–10k

TxLINE licensing, legal/compliance advice, penetration testing, unusually large inference cost, taxes, and payment-provider cost are variable and excluded.

### 3.3 Competition scope

Launch priority is limited to competitions whose identifiers, schedule, history, data cadence, and public-display rights are actually verified.

Priority order:

1. Premier League
2. UEFA Champions League
3. La Liga
4. Serie A
5. Bundesliga

Iran Pro League and international tournaments remain conditional until TxLINE coverage and licensing are proven. The snapshot API, not a static schedule document, is the operational source of truth.

### 3.4 Public API

The initial product supports the web application and Telegram bot. External partner API access is deferred until load, abuse, privacy, and operational testing are complete.

Public output may contain probabilities, a coarse confidence level, data quality, freshness, generated time, safe explanation, limitations, public contract version, and `standard | baseline_fallback | unavailable` mode.

Public output must not expose:

- raw confidence score;
- internal model version;
- specialist contributions;
- feature hashes;
- provider identity or payload;
- assigned weights, coefficients, formulas, thresholds, or proof blobs.

### 3.5 Database and migrations

Codex may create development migrations and may apply them only to an isolated local or ephemeral development database when the phase pack permits it.

Shared development, staging, and production mutation require separate approval. Staging approval requires backup, dry-run/shadow diff, rollback, and post-check evidence. Production is never auto-approved.

### 3.6 TxLINE environment

The submitted `staging` assumption is replaced by the documented test environment until TxLINE confirms a distinct staging service.

Documented hosts:

- Test/dev: `http://txline-dev.txodds.com`
- Production: `https://txline.txodds.com`

Documented runtime secret names in the current project are `TXLINE_GUEST_JWT` and `TXLINE_API_TOKEN`; generic `TXLINE_API_KEY` and `TXLINE_CLIENT_ID` are not adopted without provider evidence.

Real network access remains disabled. Production requires a contract review covering competition entitlements, quota, retention, attribution, support, payment/subscription mechanics, and sanctions/export-control eligibility.

### 3.7 Prediction quality

One universal Brier threshold is rejected because target definitions and score normalization can differ.

Production quality uses:

- at least 1,000 completed matches per priority competition;
- at least 200 samples for a critical segment;
- overall ECE no greater than 0.05;
- critical-segment ECE no greater than 0.08;
- target-specific Brier definitions;
- at least 5% relative improvement over an approved baseline;
- no critical-segment regression above 2%;
- standard-mode feature coverage at least 95%;
- explicit fallback or suppression for stale core live state.

Absolute per-target thresholds must be finalized from the 10J-B baseline report before production release.

### 3.8 Hosting and observability

AWS Frankfurt is a candidate, not a committed provider. Infrastructure must remain portable enough to use another approved EU provider.

The initial operational stack should minimize unnecessary platform complexity:

- OpenTelemetry instrumentation;
- provider-managed logs and metrics;
- Grafana-compatible dashboards;
- Sentry or approved equivalent;
- blue/green deployment;
- managed PostgreSQL and Redis-compatible cache.

No paid account, DNS change, or deployment is authorized until the compliance/provider gate passes.

### 3.9 Privacy and age policy

For v1, account creation and notification enrollment are limited to users aged 16 or older. A 13–15 parental-consent workflow is not implemented until jurisdiction-specific legal design is approved.

GDPR Article 8 uses 16 as the default age for consent in relation to information-society services and allows Member States to set a lower age no lower than 13. A single global 13–16 rule is therefore insufficient for an EU-facing production service.

Personal data remains minimal: watchlists, preferences, Telegram chat identifier, and security/operational metadata. Notification delivery requires explicit opt-in. Deletion and retention behavior must be tested.

## 4. Deferred and rejected scope

### 4.1 Solana

Solana network access is not required for v1 production completion.

Phase 10N-A may implement offline proof transport and structural validation. Phase 10N-B is deferred and not required for `PROGRAM_COMPLETE` v1.

The following are prohibited in v1 and are not future defaults:

- prediction markets;
- wagering or gambling services;
- prediction-linked rewards;
- ordinary-user wallets;
- token purchase or transaction flows in the user product.

Any reconsideration requires a separate legal, provider, security, cost, and human gate.

### 4.2 Payments and monetization

Payment processing and paywalls are outside v1. Monetization may be designed later only after provider rights, sanctions/export-control analysis, payment-provider eligibility, privacy, tax, and product policy are approved.

## 5. Compliance gate

The production program adds `GATE_COMPLIANCE_PROVIDER`.

It blocks:

- real TxLINE access;
- paid cloud commitment;
- public beta involving real provider data;
- production deployment;
- payment integration;
- any Solana reconsideration.

Required evidence:

- written scope and approval from qualified legal/compliance counsel;
- provider terms and data-rights review;
- cloud/account eligibility confirmation;
- data-flow, retention, privacy, and international-transfer review;
- approved ownership for accounts, billing, incidents, and release.

OFAC maintains an active Iran sanctions program. Provider availability and account eligibility must be confirmed directly rather than inferred from technical availability. The EU GDPR applies to offering services to people in the EU and includes child-consent and data-subject obligations.

Primary legal references:

- `https://ofac.treasury.gov/sanctions-programs-and-country-information/iran-sanctions`
- `https://eur-lex.europa.eu/eli/reg/2016/679/oj`

## 6. Remaining human-owned decisions

The following cannot be completed by Codex alone:

1. appoint qualified legal/compliance counsel;
2. obtain and review the TxLINE commercial/service agreement;
3. select and approve the cloud account and billing owner;
4. prove ownership of the production domain;
5. assign named Backend, ML, DevOps, QA, security, privacy, product, and release owners;
6. install secrets into an approved secret store without exposing values;
7. approve the exact private inference runtime and calibration artifact location;
8. procure or approve an independent penetration test;
9. approve staging mutation, production deployment, and final release.

Codex should continue automatically through every phase that does not require these inputs, then stop at the first applicable hard gate with a precise `INPUT_REQUIRED` report.
