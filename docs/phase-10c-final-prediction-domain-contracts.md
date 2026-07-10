# Phase 10C — Final Prediction Domain Contracts

These are permanent, production-grade, versioned contracts for MatchPulse prediction snapshots, labels, evaluation, Odds Intelligence, and public Market Intelligence. Prediction targets use stable identifiers rather than user-facing text. Snapshots are immutable observations at `as_of`; future data must not enter their features. Labels are created only from information occurring after `as_of`.

Odds Intelligence has two separate outputs. Internal Odds Intelligence may support model weighting only after structural validity, timestamp validity, freshness, market identification and completeness, provider coverage and agreement, dispersion, outlier, movement integrity, event consistency, and overall reliability have been assessed. Public Market Intelligence contains safe summaries and never raw odds, provider payloads, private rankings, weights, coefficients, or fair-probability internals.

No odds data influences a prediction before its validity, freshness,
market completeness, provider agreement, anomaly status, and reliability
have been assessed.

This phase defines contracts, recursive safety validation, and immutable cloning builders. It does not calculate predictions, implied probabilities, overround, provider consensus, or anomaly algorithms; train models; create database tables; or change API routes, frontend, workers, Telegram, Solana, or TxLINE integrations. The next phase is permanent prediction snapshot and label storage.
