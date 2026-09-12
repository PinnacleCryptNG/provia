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

The judged demo must keep **one long-lived Node process** for `/api/intents`, `/api/preflight`, `/api/verify`, and `/api/proofs`. Intents, proof records, and replay protection are in-memory on that process.

**Do not use a Vercel URL as the judged demo.** `vercel.json` + `api/index.ts` are a serverless adapter. Separate isolates do not share Maps, so a payment can lose its intent between create and verify.

Nimiq Pay should load a **public HTTPS** Mini App URL. The smallest reliable way is: run PROVIA locally, then put a Cloudflare Tunnel in front of that one process.

### Start command

```bash
npm install
npm run build
npm start
```

Leave `npm start` running. In a second terminal, expose it:

```bash
cloudflared tunnel --url http://127.0.0.1:43124
```

Open the printed `https://….trycloudflare.com` URL in **Nimiq Pay → Testnet → Mini Apps**.

`npm start` is one Node process. It serves the Vite production build from `dist/` and every `/api/*` route from the same listener, so in-memory state survives the whole session.

Keep that process alive for the whole demo. Restarting it clears intents and proofs. Restarting the tunnel changes the public URL.

### Required environment variables

None required for Testnet.

| Variable | Default | When to set |
|---|---|---|
| none | — | Testnet demo works with defaults |
| `NIMIQ_RPC_URL` | `https://rpc.testnet.nimiqwatch.com` | Only to point observation at a different Testnet RPC. Do not set this to Mainnet for the judged demo. |
| `PORT` or `PROVIA_SERVER_PORT` | `43124` | Only if the local port is taken |
| `PROVIA_SERVER_HOST` | `127.0.0.1` | Leave as localhost when using a tunnel |

### Ports

- **43124** — judged `npm start` Mini App + API (tunnel this)
- **43123** — Vite dev Mini App (`npm run dev` only)
- **43124** — API during `npm run dev` (Vite proxies `/api` here)

### Alternative: local `npm run dev` + tunnel

If you skip the production build:

```bash
npm run dev
cloudflared tunnel --url http://127.0.0.1:43123
```

That starts Vite on `43123` and the API on `43124`. Tunnel **43123** so `/api` stays proxied to the same API process. This is two child processes; memory still lives in the one API process.

### Not judged: Vercel

Vercel can host the static Mini App, but each serverless isolate has its own memory. That is not a valid judged-demo deployment.


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

Vite proxies `/api` to `http://127.0.0.1:43124`. For a LAN-only phone test you may enter the Vite Network URL in Nimiq Pay. For the judged recording, use `npm start` plus an HTTPS tunnel (above).

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

1. Start `npm start` (after `npm run build`) and a Cloudflare Tunnel to port `43124`.
2. Open Nimiq Pay on Testnet.
3. Enter the `https://….trycloudflare.com` tunnel URL in Mini Apps.
4. Send NIM. PROVIA checks the recipient on the Send screen, then locks the payment details on the server before Review.
5. Confirm in Nimiq Pay.
6. PROVIA independently verifies the on-chain payment after 60 confirmations. If it is verified, it issues a verification record for this session.

## Tests

```bash
npm test
```

## Production build

```bash
npm run build
```

Vercel can serve the Vite build plus `api/index.ts`. That adapter reuses `createProviaRequestListener()`, but each serverless isolate has its own memory. Do not use it for the judged demo. `npm start` after `npm run build` is the judged path: one Node process serves `dist/` and `/api`.
