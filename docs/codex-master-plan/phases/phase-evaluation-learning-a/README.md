# EVALUATION-LEARNING-A v1

Build temporal labels only from data after prediction `as_of`, evaluate immutable snapshots with log loss/Brier/ECE and segmented quality, seal versioned datasets, and support deterministic batch retraining plus bounded online shadow updates. Champion artifacts remain immutable; promotion is atomic and gated; rollback is automatic on invariant, safety, runtime, or quality regression. If data is insufficient, record `WAITING_FOR_TRAINING_DATA` and create no model.
