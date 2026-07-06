# MatchPulse Submission Checklist

Use this checklist when preparing the final hackathon or demo submission.

## Links

- Demo link: `TBD`
- GitHub repo link: `TBD`

## Video / Pitch Checklist

- Show the `/demo` page loading successfully.
- Show the public API status route.
- Show the public match list route.
- Show the public match detail and bundle for fixture `17952170`.
- Show the demo bridge responses and the raw JSON toggle.
- Explain the difference between public API, demo bridge, mock legacy routes, and internal routes.
- Keep the pitch focused on data quality and signal visibility.

## Architecture Explanation Checklist

- MatchPulse is a sports intelligence and real-time data quality platform.
- The public frontend uses `/api/public/*`.
- The demo page uses `/api/demo/*`.
- `/api/matches` remains mock and intentionally preserved.
- `/api/internal/*` is backend-only and must not be used by the frontend.
- SignalCore reports data-quality signals.
- Agent Presenter produces a safe natural-language brief.
- The worker has safe dry-run behavior.

## Safety Boundaries

- No betting or wagering mechanics.
- No prediction or recommendation engine.
- No probability, confidence, edge, or winner output.
- No wallet connect, payment, deposit, or payout flow.
- No Redis, queues, or automatic DB-writing scheduler.
- No secrets in logs or committed docs.
- No live execute during submission prep.
- No DB writes during checklist verification.

## What Judges Should Notice

- The product clearly separates public, demo, mock, and internal surfaces.
- The demo is transparent and auditable.
- The worker and schedule commands are guarded.
- The documentation explains exactly what is safe to run.
- The system presents sports data quality, not betting advice.

## Known Limitations

- Demo fixtures are allowlisted and hardcoded.
- The legacy mock endpoint is still present.
- No automatic scheduler is enabled yet.
- No queue infrastructure is used.
- Neon usage should remain controlled and low-frequency.

## Next Production Steps

- Confirm final deployment hosting.
- Add production monitoring and alerts.
- Define an operator-owned refresh cadence if needed.
- Expand fixture coverage only if there is a clear demo or product need.
- Keep public API and demo bridge boundaries intact.
- Revisit scheduling only if operational demand proves it is necessary.

## Final Submission Checks

- Public API smoke checklist completed.
- Demo flow verified.
- Worker dry-run verified.
- Repository status clean except for intended docs.
- No secrets printed.
- No live execute run.
- No DB writes.
- No TxLINE calls.
- No automatic DB-writing scheduler added.
