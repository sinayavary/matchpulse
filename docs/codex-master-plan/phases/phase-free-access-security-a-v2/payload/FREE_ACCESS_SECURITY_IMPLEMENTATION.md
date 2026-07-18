# Implementation contract

Implement only the reviewed PR #34 contract on the current baseline: off-chain Solana wallet challenge/signature authentication; replay/expiry/domain/URI/chain and attempt protections; secure HttpOnly sessions with CSRF and strict origin checks; free applications with ownership isolation; one-time hashed client secrets; rotation/revocation; short-lived opaque bearer tokens without refresh tokens; read-only scopes; safe same-origin BFF; bounded durable rate/quota controls; redacted audit metadata; and fail-closed separation of internal and external identity.

The wallet login must never request a blockchain transaction. Credentials must not be persisted in browser storage. Implement the Developer Documentation Portal contract in the architecture document, including examples and OpenAPI reference without internal routes, secrets, raw provider data, or private formulas.

Prisma schema/migration and dependency changes are allowlisted only for the implementation phase and require the stated human gates; a migration must be created/validated but not applied to production. Run every command in `manifest.json`, record actual counts, verify exact paths, and report migration applied `false`, network accessed `false`, no deployment, and no fabricated data.

Do not merge, rebase, or force-update PR #34. Do not access production, Railway, secrets, or network. Do not execute this implementation during the governance transition.
