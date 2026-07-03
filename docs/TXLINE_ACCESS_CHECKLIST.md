# TxLINE Access Checklist

## 1. Goal

Get valid TxLINE credentials for the backend and worker.

The app should start on **devnet** for development and activation-flow testing.

Initial development target:

- `NETWORK=devnet`
- `SERVICE_LEVEL_ID=1`
- devnet free tier documented for World Cup / International Friendlies where available

Final submission target after development is stable:

- `NETWORK=mainnet`
- `SERVICE_LEVEL_ID=12`
- World Cup & International Friendlies real-time free tier, if available

Final fallback:

- `NETWORK=mainnet`
- `SERVICE_LEVEL_ID=1`
- 60-second delayed free tier

---

## 2. Required Concepts

TxLINE access uses:

1. Guest JWT from guest auth endpoint
2. Solana on-chain subscription transaction
3. Signed activation message
4. API token returned from activation endpoint
5. Both headers on every data API request:
   - `Authorization: Bearer <jwt>`
   - `X-Api-Token: <apiToken>`

---

## 3. Devnet Configuration — First Target

```env
TXLINE_NETWORK=devnet
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
TXLINE_API_BASE=https://txline-dev.txodds.com/api
TXLINE_GUEST_AUTH_URL=https://txline-dev.txodds.com/auth/guest/start
TXLINE_SERVICE_LEVEL_ID=1
TXLINE_SELECTED_LEAGUES=
```

TODO: add confirmed devnet program ID, TxL mint, wallet address, and RPC URL after setup.

---

## 4. Mainnet Configuration — Final Submission Target

```env
TXLINE_NETWORK=mainnet
TXLINE_API_ORIGIN=https://txline.txodds.com
TXLINE_API_BASE=https://txline.txodds.com/api
TXLINE_GUEST_AUTH_URL=https://txline.txodds.com/auth/guest/start
TXLINE_SERVICE_LEVEL_ID=12
TXLINE_SELECTED_LEAGUES=
```

Use mainnet after devnet flow is stable.

---

## 5. Do Not Mix Networks

Never activate a devnet transaction on mainnet API host.
Never activate a mainnet transaction on devnet API host.

The following must all match the same network:

- RPC URL
- Program ID
- TxL mint
- guest JWT host
- activation endpoint
- API base URL
- subscription transaction

---

## 6. Environment Variables

```env
TXLINE_NETWORK=mainnet
TXLINE_API_ORIGIN=
TXLINE_API_BASE=
TXLINE_GUEST_AUTH_URL=
TXLINE_SERVICE_LEVEL_ID=12
TXLINE_SELECTED_LEAGUES=

TXLINE_JWT=
TXLINE_API_TOKEN=
TXLINE_TOKEN_EXPIRES_AT=

SOLANA_RPC_URL=
SOLANA_WALLET_PUBLIC_KEY=
SOLANA_WALLET_SECRET_KEY_BASE64=
```

Security note: never commit secrets.

---

## 7. First Integration Targets

Start with REST endpoints before SSE:

1. fixtures snapshot / updates
2. scores snapshot for a fixture
3. odds snapshot for a fixture
4. scores updates
5. odds updates
6. streams later

---

## 8. Backend Tasks

- [ ] Create `TxlineConfig` module
- [ ] Create guest auth function
- [ ] Create token activation flow
- [ ] Store JWT and API token securely
- [ ] Implement token refresh on 401
- [ ] Implement `TxlineClient` with common headers
- [ ] Implement fixture fetcher
- [ ] Implement score reader
- [ ] Implement odds reader
- [ ] Implement controlled errors for 401/429/5xx

---

## 9. Wallet / Keypair Requirement

For TxLINE activation, the project needs a Solana wallet or local keypair that can:

- exist on devnet for development
- sign the on-chain subscription transaction
- sign the activation message
- provide a public key for subscription
- keep the private key/secret out of Git

Recommended MVP approach:

1. Create a dedicated development Solana wallet/keypair.
2. Use it only for TxLINE activation and backend credentials.
3. Store the secret locally or in Railway environment variables only after the team agrees who owns it.
4. Do not require normal users to connect a wallet.

## 10. Open Questions

Need answers from project owner/team:

1. Which dedicated Solana devnet wallet/keypair will be used?
2. Who will hold the wallet secret during development?
3. Will activation be handled by backend local keypair or manually by a developer wallet first?
4. Do we need separate devnet and mainnet deployments?
5. Do we have access to TxLINE Discord/Telegram support?

