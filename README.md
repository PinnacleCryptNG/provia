# PROVIA

PROVIA is a Nimiq Pay Mini App for payment verification.

Thesis: **Intent → Evidence → Verification → Proof**.

A wallet transaction hash is a submission receipt. It is not verification. The Mini App sends the payment **intent** and **transaction hash** to the PROVIA server. The server independently observes the Nimiq chain and runs the shared `verifyPayment()` engine.

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

1. Vite Mini App (port `5173`, LAN-reachable)
2. PROVIA verification server (port `43124` on this machine)

Start both together:

```bash
npm run dev
```

That is equivalent to:

```bash
npm run dev:server
npm run dev:client -- --host
```

Vite is configured with `server.host: true` and proxies `/api` to `http://127.0.0.1:43124`. Copy the **Network URL** from the Vite terminal, for example:

```text
http://192.168.1.42:5173
```

Do not open `localhost` from the phone. In the phone's WebView, localhost is the phone.

The Mini App calls relative `POST /api/verify`. The phone never talks to `127.0.0.1:43124` and does not need a hardcoded localhost API URL. Vite on this machine forwards `/api` to the verification server, which then calls Nimiq RPC.

Override the RPC endpoint with `NIMIQ_RPC_URL` if you replace the prototype public node. The default is `https://rpc.testnet.nimiqwatch.com`. Clients cannot supply an RPC URL.

## Load it in Nimiq Pay

1. Open Nimiq Pay.
2. Long-press Settings for 10 seconds and switch to **Testnet**.
3. On testnet, use **Get free NIM** if the account is empty.
4. Go to Mini Apps and enter the Vite Network URL.
5. Wait until the app shows **Nimiq Pay connected**.
6. Enter a recipient Nimiq address, a positive NIM amount, and an optional purpose.
7. Tap **Review payment**. Confirm that the network reads **Nimiq Testnet**.
8. Tap **Confirm payment** and approve the native Nimiq Pay dialog.
9. You should see **Payment submitted**, then a short sequence of server verification requests.
10. The final screen is the server's `verifyPayment()` outcome: verified, mismatch, failed, or not verified yet.

Verification requires 60 confirmations (one Albatross batch). A brand-new testnet payment will usually land as **Payment not verified yet**. Use **Check again** after the transaction has had time to confirm. That is not a failed payment.

## Tests

```bash
npm test
```

Verifier tests are offline. Server API tests use mocked RPC. The live Testnet observation test in `tests/observe.test.ts` still hits public RPC and is useful as a spike check.

## Production build

```bash
npm run build
```

The Mini App build is the Vue client. The verification server is started separately with `npm run dev:server`.

## Network identifiers

Payment intents use an explicit network:

- `NIMIQ_TESTNET` (current default)
- `NIMIQ_MAINNET`

The generic string `"Nimiq"` is not a network. Observed `networkId` from the chain is the evidence used by verification.

## Observation

The Mini App makes a small number of `POST /api/verify` requests with a pause between attempts, then stops. Each server request performs one RPC lookup. Public Nimiq.watch RPC is rate-limited. Retry is manual.
