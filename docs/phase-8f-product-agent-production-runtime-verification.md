# Phase 8F — Product Agent Production Runtime Verification

This runbook verifies the protected internal Product Agent route for final product readiness. It is intended for local operator/developer verification of the existing route and introduces no product feature.

## Route under test

```text
GET /api/internal/product-agent/matches/:fixtureId/insight
```

The route accepts either of these internal authentication forms:

- `x-matchpulse-internal-token: <token>`
- `Authorization: Bearer <token>`

## 1. Configure the required environment

In PowerShell, set a local test token before starting the API:

```powershell
$env:MATCHPULSE_INTERNAL_TOKEN="local-internal-test-token"
```

Never commit a real token. Never expose this token to browser/client-side code. Never expose this token to Telegram users.

## 2. Start the API

From the repository root, start the existing local API command:

```powershell
pnpm.cmd dev:api
```

Use a second PowerShell window for the requests below. The examples use fixture `17952170`; a successful `200` response requires internal data to be available for that fixture.

## 3. Verify valid custom-header authentication

```powershell
curl.exe `
  -H "x-matchpulse-internal-token: local-internal-test-token" `
  "http://localhost:4000/api/internal/product-agent/matches/17952170/insight"
```

Expected result when internal data is available:

- HTTP `200`
- `meta.source = product-agent`
- `meta.mode = internal`
- `data.agent_version = product-agent-v1`
- `data.decision_context` exists because this is an internal-only response

## 4. Verify valid Bearer authentication

```powershell
curl.exe `
  -H "Authorization: Bearer local-internal-test-token" `
  "http://localhost:4000/api/internal/product-agent/matches/17952170/insight"
```

Expected result: the same protected-route success behavior as the custom-header request.

## 5. Verify query normalization and optional flags

```powershell
curl.exe `
  -H "x-matchpulse-internal-token: local-internal-test-token" `
  "http://localhost:4000/api/internal/product-agent/matches/17952170/insight?staleAfterMinutes=180&oddsLimit=20&includeEventImpact=true&includeOddsReliability=true"
```

Expected result: the request is accepted and the bounded, normalized values are passed to Product Agent. The response remains internal-only.

## 6. Verify explicit `false` flags

```powershell
curl.exe `
  -H "x-matchpulse-internal-token: local-internal-test-token" `
  "http://localhost:4000/api/internal/product-agent/matches/17952170/insight?includeEventImpact=false&includeOddsReliability=false"
```

Expected result:

- The request succeeds.
- Explicit `false` values are preserved and passed through to Product Agent; they are not replaced by defaults through truthiness handling.

## 7. Verify missing authentication

```powershell
curl.exe `
  "http://localhost:4000/api/internal/product-agent/matches/17952170/insight"
```

Expected result:

- HTTP `401`
- `data = null`
- `message = Internal authorization is required.`
- No token or secret is echoed.

## 8. Verify incorrect authentication

```powershell
curl.exe `
  -H "x-matchpulse-internal-token: wrong-token" `
  "http://localhost:4000/api/internal/product-agent/matches/17952170/insight"
```

Expected result:

- HTTP `401`
- `message = Internal authorization failed.`
- No expected or provided token is echoed.

Malformed authorization, such as a non-Bearer `Authorization` value, must also fail safely with HTTP `401`.

## 9. Verify invalid query names

```powershell
curl.exe `
  -H "x-matchpulse-internal-token: local-internal-test-token" `
  "http://localhost:4000/api/internal/product-agent/matches/17952170/insight?includeState=true"
```

Expected result:

- HTTP `400`
- `message = Invalid Product Agent route query.`
- The unknown query name is not echoed.

## 10. Product safety checks

Confirm all of the following during verification:

- This route is internal-only.
- It is not a public product API.
- It must not be called from browser/client-side frontend code.
- It must not be exposed through `/api/matches`.
- It must not be exposed through `/api/public/*`.
- It must not be exposed to Telegram users.
- `decision_context` is internal-only.
- Raw SignalCore output must not be exposed.
- `internal_context` must not be exposed.
- Stack traces, environment values, and tokens must not be exposed.

The Product Agent response must remain behind the internal authorization boundary. A failed request must not disclose credentials, secrets, or implementation details.

## 11. Automated validation

Run the focused route and contract tests from the repository root:

```powershell
.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/server-product-agent-route.test.ts
.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/internal-auth.test.ts
.\apps\api\node_modules\.bin\tsx.CMD --test apps/api/src/product-agent-route-contract.test.ts
```

If the dependencies are available, also run:

```powershell
.\node_modules\.bin\tsc.CMD -p apps/api/tsconfig.typecheck.json --noEmit
pnpm.cmd --filter @matchpulse/api test
```

## Scope and limitations

This document verifies the existing protected route at runtime. It does not change route logic, Product Agent logic, public API behavior, frontend behavior, schemas, migrations, or external integrations. A `200` result depends on the selected fixture having available internal data; authorization and validation behavior can still be verified independently with the focused tests and failure cases.
