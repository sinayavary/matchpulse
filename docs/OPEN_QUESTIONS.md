# Open Questions for Project Owner

Please answer these before backend and frontend start final implementation.

## 1. Team and Repo

1. ANSWERED: Use one monorepo for frontend, backend, worker, shared packages, docs, and mock data.
2. Who owns deployment accounts for Vercel and Railway?
3. What GitHub organization/user will host the public repo?

## 2. TxLINE Access

4. ANSWERED PARTIALLY: Use a Solana wallet/keypair that supports devnet, transaction signing, and message signing. Final wallet/keypair still needs to be created or selected.
5. ANSWERED: Start on devnet service level 1 for development; switch to mainnet service level 12 for final submission if access is stable.
6. ANSWERED: Devnet is the initial development environment, not only fallback.
7. Do you already have access to TxLINE Discord/Telegram support?

## 3. Product Scope

8. ANSWERED: Telegram bot/alerts must be included in MVP.
9. ANSWERED: Leaderboard is not needed in MVP. Lightweight group rooms are optional only if they do not delay core delivery.
10. Should the app include Persian language later, or English only forever?

## 4. Agent Logic

11. Which markets from odds should be prioritized first?
12. Which events are most important for the first version: goals, cards, penalties, odds shifts?
13. Should scenario names be generic or team-specific?

## 5. Branding

14. ANSWERED: MatchPulse/SignalCore are temporary working names. Final name will be changed near the end.
15. Final agent name: SignalCore or another name?
16. ANSWERED: A clear blend of modern sports app + Solana/Web3 environment. The Web3/Solana layer must be visible, not hidden.

## 6. Demo

17. Which demo match should be used for replay mode?
18. Should the demo focus first on SignalCore Agent or MatchPulse App?
19. Should the demo include a technical API walkthrough?



## Newly Open Questions

20. Which Solana wallet/keypair will be created for devnet activation?
21. Who will hold the devnet wallet secret locally during development?
22. Should the backend use a local server-side Keypair for activation, or should a developer wallet adapter sign the activation message manually first and store the API token?
23. Which Telegram bot username/token will be used for MVP alerts?
24. What GitHub repo name should the monorepo use?
