# PROVIA

PROVIA is a Nimiq Pay Mini App for independent payment verification.

A successful wallet submission is not proof of payment. PROVIA checks Nimiq blockchain evidence independently, then issues a verification record only when the payment matches and has 60 confirmations.

The Mini App checks the destination as soon as a recipient is entered. That preflight answers whether the address is a supported Nimiq Testnet destination **before** Review. Continue then creates a **server-owned payment intent** with the exact recipient, amount, network, and intent ID. After Nimiq Pay returns a transaction hash, the Mini App sends only `intentId` and `transactionHash`. The server looks up the stored intent, independently observes the Nimiq chain, and runs the shared `verifyPayment()` engine. A **PROVIA verification proof** is issued only when that engine returns `VERIFIED`. Preflight is not payment verification.

Recipient preflight uses `getAccountByAddress` on that network’s RPC:

- Valid checksummed Nimiq address
- Account exists/resolves on the selected network (no silent network fallback)
- Reject HTLC, vesting, and staking **recipient** account types
- Reject the protocol staking contract and coinbase addresses from `getPolicyConstants`

Nimiq does not publish a protocol burn address. A zero-balance basic account is not treated as a burn. PROVIA does not claim address-poisoning detection from an address string; review shows the full stored recipient, and verification compares that exact recipient on-chain.

Nimiq Pay Testnet may settle `sendBasicTransactionWithData` as an HTLC payout (`fromType = 2`). That is the **sender** of the observed settlement, not the intended recipient. PROVIA still accepts that path only when on-chain `recipientData` decodes exactly to `PROVIA:<serverIntentId>` and the recipient, amount, network, execution, and 60-confirmation checks still pass. Unbound HTLC payouts are rejected. Basic NIM transfers remain valid under the existing rules.

```text
Mini App  →  PROVIA server  →  Nimiq RPC
```

## Judged demo (required)

The reliable Cycle 2 judged demo uses **one long-lived local Node process**, not a serverless deployment.

Intents, proof records, and replay protection are stored in memory on that process. That is enough for a LAN demo. It is **not** durable across Vercel serverless isolates. Separate function instances can lose intent state. Do not use a Vercel URL as the judged demo.

1. On this machine:

   ```bash
   npm install
   npm run dev
   ```

2. Leave that process running. It starts:

   - Vite Mini App on port `43123` (LAN-reachable)
   - PROVIA verification server on port `43124`

3. Vite proxies `/api` to `http://127.0.0.1:43124`, so the Mini App and API share the same long-lived server.

4. In Nimiq Pay (Testnet), open the Vite **Network URL**, for example `http://192.168.1.42:43123`. Do not use `localhost` on the phone.

Keep that Node process alive for the whole demo. Restarting it clears in-memory intents and proofs.

## Requirements

- Node.js 22 or later
- Nimiq Pay on a phone or emulator on the same Wi-Fi network as this machine

## Install

```bash
npm install
```

## Run locally

Development has two processes, started together by `npm run dev`:

1. Vite Mini App (port `43123`, LAN-reachable)
2. PROVIA verification server (port `43124` on this machine)

```bash
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:43124`. Open the **Network URL** from Nimiq Pay.

## API

- `POST /api/preflight` — check a recipient without creating an intent
- `POST /api/intents` — create a server-owned intent (`pi_…`)
- `GET /api/intents/:intentId` — retrieve the stored intent
- `POST /api/verify` — `{ intentId, transactionHash }`
- `POST /api/proofs` — independently verify again; issue a proof only if `VERIFIED`
- `GET /api/proofs/:proofId` — retrieve a stored proof
- `GET /health`

Intents and proofs are in-memory for this prototype. Restarting the server clears them. Vercel does not provide durable intent state.

## Load it in Nimiq Pay

1. Open Nimiq Pay on Testnet.
2. Enter the Vite Network URL in Mini Apps.
3. Send NIM. PROVIA checks the recipient on the Send screen, then locks the payment details on the server before Review.
4. Confirm in Nimiq Pay.
5. PROVIA independently verifies the on-chain payment after 60 confirmations. If it is verified, it issues a verification record for this session.

## Tests

```bash
npm test
```

## Production build

```bash
npm run build
```

Vercel can serve the Vite build plus `api/index.ts`. That adapter reuses `createProviaRequestListener()`, but each serverless isolate has its own memory. Local `npm run dev` is the judged demo path: Vite’s proxy to port `43124` uses one long-lived Node server.
