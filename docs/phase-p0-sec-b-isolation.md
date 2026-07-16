# P0-SEC-B — Telegram Webhook, Raw Audit and Legacy Route Isolation

P0-SEC-A established the central internal route boundary. The next verified
findings were sensitive Telegram webhook body logging, public legacy raw-data
exposure, and raw provider payloads included in the runtime audit HTTP response.
This phase removes those response/logging exposures without deleting internal
audit storage or changing the public analysis contract.

No migration, database write, production network, secret acquisition, or
breaking public contract is allowed. The next default phase after publication
is P0-SEC-C.
