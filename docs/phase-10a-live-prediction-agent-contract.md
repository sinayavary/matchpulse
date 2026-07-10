# Phase 10A — Live Prediction Agent Contract

This phase starts the MatchPulse live prediction agent as an internal contract layer. It is contract-only: it does not implement final probability formulas, train a model, or expose predictions publicly.

The contract supports outcome probabilities, scenario probabilities, confidence, risk, and explanation. It uses conservative deterministic defaults while the final prediction engine is not implemented.

The contract is internal-only for now. Its safety assertion rejects wagering, stake, payout, wallet, EV, debug, secret, and model-internal fields, while allowing internal probability, prediction, and confidence fields.

The next phase is the prediction feature builder, which can prepare bounded live inputs for a future probability engine.
