# MatchPulse — Final Smoke Checklist

A command-by-command verification checklist to confirm the demo pipeline is working correctly.

Run all commands from the repository root: `D:\money\matchpulse_repo`

---

## Backend Startup

### 1. Start the API server

```powershell
cd D:\money\matchpulse_repo
pnpm.cmd --filter @matchpulse/api dev
```

**Expected:** Server starts and logs `Server listening at http://0.0.0.0:4000`.

---

## Backend Smoke Tests

Run each command in a separate terminal while the API is running.

### 2. Health check

```powershell
curl.exe http://localhost:4000/api/health
```

**Expected:** JSON response confirming the API is healthy.

### 3. Public demo bridge — list matches

```powershell
curl.exe http://localhost:4000/api/demo/matches
```

**Expected checks:**
- [ ] Response contains `data` array with exactly 2 items
- [ ] First item has `fixture_id: "17952170"` (Slovenia vs Cyprus)
- [ ] Second item has `fixture_id: "17588223"` (Mexico vs South Korea)
- [ ] `meta.source` is `"demo-bridge"`
- [ ] `meta.mode` is `"public-demo"`
- [ ] `meta.status` is `"live"`

### 4. Slovenia vs Cyprus bundle

```powershell
curl.exe http://localhost:4000/api/demo/matches/17952170/bundle
```

**Expected checks:**
- [ ] `data` is not null
- [ ] `data.fixture_id` is `"17952170"`
- [ ] `data.readiness.display_ready` is `true`
- [ ] `data.readiness.has_scoreboard` is `true`
- [ ] `data.state.scoreboard` shows `home_score: 1` and `away_score: 1`
- [ ] `data.readiness.has_odds` is `false`
- [ ] Signals include `DATA_READY` type
- [ ] Signals include `ODDS_MISSING` type
- [ ] `meta.source` is `"demo-bridge"`
- [ ] `meta.mode` is `"public-demo"`

### 5. Mexico vs South Korea bundle (full options)

```powershell
curl.exe "http://localhost:4000/api/demo/matches/17588223/bundle?includeState=true&includeSignals=true&includeBrief=true&oddsLimit=20"
```

**Expected checks:**
- [ ] `data` is not null
- [ ] `data.fixture_id` is `"17588223"`
- [ ] `data.readiness.display_ready` is `true`
- [ ] `data.readiness.has_odds` is `true`
- [ ] `data.readiness.has_scoreboard` is `false`
- [ ] Signals include `ODDS_AVAILABLE` type
- [ ] Signals include `SCOREBOARD_MISSING` type
- [ ] `data.brief` is not null
- [ ] `data.signal_summary` is not null
- [ ] `meta.source` is `"demo-bridge"`
- [ ] `meta.mode` is `"public-demo"`

### 6. Non-existent fixture (safe fallback)

```powershell
curl.exe http://localhost:4000/api/demo/matches/not-real/bundle
```

**Expected checks:**
- [ ] `data` is `null`
- [ ] `meta.status` is `"no_data"`
- [ ] `meta.source` is `"demo-bridge"`
- [ ] `meta.mode` is `"public-demo"`
- [ ] `meta.message` contains a safe message (e.g., "Demo fixture not found.")
- [ ] No error codes, stack traces, or internal details leaked

### 7. Mock matches endpoint (separate from demo)

```powershell
curl.exe http://localhost:4000/api/matches
```

**Expected checks:**
- [ ] Response contains mock data
- [ ] `source` is `"mock"` (not `"demo-bridge"`)
- [ ] `mode` is `"mock"` (not `"public-demo"`)
- [ ] Completely independent of the demo pipeline

---

## Frontend Startup

### 8. Start the frontend (in a separate terminal)

```powershell
cd D:\money\matchpulse_repo
pnpm.cmd --filter @matchpulse/web dev
```

**Expected:** Next.js starts and logs `Local: http://localhost:3000`.

---

## Frontend Smoke Tests

### 9. Open the demo page

Navigate to: **http://localhost:3000/demo**

**Expected checks:**
- [ ] Page loads without errors
- [ ] Page title shows "MatchPulse Demo"
- [ ] Subtitle reads "Safe sports data intelligence demo"
- [ ] Match selector shows exactly 2 fixtures

### 10. Select Slovenia vs Cyprus

**Expected checks:**
- [ ] Match Intelligence Card loads
- [ ] Agent Brief panel loads with natural-language summary
- [ ] Signal Feed shows signals (info/warning severity)
- [ ] Data Quality Panel shows `has_scoreboard: true`
- [ ] Data Quality Panel shows `has_odds: false`
- [ ] Scoreboard displays `1 – 1`

### 11. Select Mexico vs South Korea

**Expected checks:**
- [ ] Match Intelligence Card loads
- [ ] Agent Brief panel loads
- [ ] Signal Feed shows signals
- [ ] Data Quality Panel shows `has_odds: true`
- [ ] Data Quality Panel shows `has_scoreboard: false`

### 12. Test Raw JSON Toggle

For either fixture:

**Expected checks:**
- [ ] Toggle button is visible
- [ ] Clicking it reveals/hides raw JSON panel
- [ ] JSON includes `meta.source: "demo-bridge"`
- [ ] JSON includes `meta.mode: "public-demo"`
- [ ] JSON is valid and complete

---

## Safety Verification

### 13. Confirm no internal routes are exposed

These routes should **not** be called by the frontend and are not documented for end users:

- [ ] `/api/internal/*` routes are not referenced in `apps/web/lib/demo-api.ts`
- [ ] Frontend only calls `/api/demo/matches` and `/api/demo/matches/:fixtureId/bundle`

### 14. Confirm no forbidden content in output

Inspect the raw JSON for either fixture:

- [ ] No fields containing probability, confidence, edge, or expected-value
- [ ] No prediction or recommendation content
- [ ] No betting advice or wagering mechanics
- [ ] Signals contain only `{ type, severity, title, message }`

---

## Quick-Pass Summary

| # | Check | Command / Action | Pass? |
|---|-------|------------------|-------|
| 1 | API starts | `pnpm.cmd --filter @matchpulse/api dev` | ☐ |
| 2 | Health check | `curl.exe http://localhost:4000/api/health` | ☐ |
| 3 | Demo matches | `curl.exe http://localhost:4000/api/demo/matches` | ☐ |
| 4 | Slovenia bundle | `curl.exe http://localhost:4000/api/demo/matches/17952170/bundle` | ☐ |
| 5 | Mexico bundle | `curl.exe "http://localhost:4000/api/demo/matches/17588223/bundle?includeState=true&includeSignals=true&includeBrief=true&oddsLimit=20"` | ☐ |
| 6 | Not-found safe | `curl.exe http://localhost:4000/api/demo/matches/not-real/bundle` | ☐ |
| 7 | Mock separate | `curl.exe http://localhost:4000/api/matches` | ☐ |
| 8 | Frontend starts | `pnpm.cmd --filter @matchpulse/web dev` | ☐ |
| 9 | Demo page loads | Open `http://localhost:3000/demo` | ☐ |
| 10 | Slovenia UI | Select Slovenia vs Cyprus | ☐ |
| 11 | Mexico UI | Select Mexico vs South Korea | ☐ |
| 12 | Raw JSON | Toggle raw JSON panel | ☐ |
| 13 | No internal routes | Check `demo-api.ts` only calls `/api/demo/*` | ☐ |
| 14 | No forbidden content | Inspect signal fields | ☐ |
