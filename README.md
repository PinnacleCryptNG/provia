# PROVIA

PROVIA is a Nimiq Pay Mini App for independent payment verification.

A successful wallet submission is not proof of payment. PROVIA checks Nimiq blockchain evidence independently, then issues a verification record only when the payment matches and has 60 confirmations.

The Mini App creates a **server-owned payment intent**. After Nimiq Pay returns a transaction hash, the Mini App sends only `intentId` and `transactionHash`. The server looks up the stored intent, independently observes the Nimiq chain, and runs the shared `verifyPayment()` engine. A **PROVIA verification proof** is issued only when that engine returns `VERIFIED`.

```text
Mini App  →  PROVIA server  →  Nimiq RPC
```

## Requirements

- Node.js 22 or later
- Nimiq Pay on a phone or emulator on the same Wi-Fi network as this machine

## Install

```bash
npm install
```

## Run locally

Development has two processes:

1. Vite Mini App (port `43123`, LAN-reachable)
2. PROVIA verification server (port `43124` on this machine)

Start both together:

```bash
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:43124`. Open the **Network URL** from Nimiq Pay, for example `http://192.168.1.42:43123`. Do not use localhost on the phone.

## API

- `POST /api/intents` — create a server-owned intent (`pi_…`)
- `GET /api/intents/:intentId` — retrieve the stored intent
- `POST /api/verify` — `{ intentId, transactionHash }`
- `POST /api/proofs` — independently verify again; issue a proof only if `VERIFIED`
- `GET /api/proofs/:proofId` — retrieve a stored proof
- `GET /health`

Intents and proofs are in-memory for this prototype. Restarting the server clears them.

## Load it in Nimiq Pay

1. Open Nimiq Pay on Testnet.
2. Enter the Vite Network URL in Mini Apps.
3. Create a payment. PROVIA stores the intent on the server before review.
4. Confirm in Nimiq Pay.
5. PROVIA verifies against the chain. If the payment is verified, it issues a shareable proof receipt.

## Tests

```bash
npm test
```

## Production build

```bash
npm run build
```

Vercel serves the Vite build plus `api/index.ts`, which reuses `createProviaRequestListener()`. `vercel.json` rewrites `/api/*` to that function. Local `npm run dev` still uses Vite’s proxy to port `43124` and does not use the Vercel adapter.
