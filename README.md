# PROVIA

PROVIA is a Nimiq Pay Mini App for payment verification.

Thesis: **Intent → Evidence → Verification → Proof**.

This slice creates a NIM payment on **Nimiq Testnet** (`NIMIQ_TESTNET`), submits it through Nimiq Pay's official `sendBasicTransaction` method, independently observes the chain, and renders the result of the pure `verifyPayment()` engine.

A wallet transaction hash is a submission receipt. It is not verification.

## Requirements

- Node.js 22 or later
- Nimiq Pay on a phone or emulator on the same Wi-Fi network as this machine

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev -- --host
```

Vite is configured with `server.host: true` and `server.port: 5173`. Copy the **Network URL** from the terminal, for example:

```text
http://192.168.1.42:5173
```

Do not open `localhost` from the phone. In the phone's WebView, localhost is the phone.

## Load it in Nimiq Pay

1. Open Nimiq Pay.
2. Long-press Settings for 10 seconds and switch to **Testnet**.
3. On testnet, use **Get free NIM** if the account is empty.
4. Go to Mini Apps and enter the Network URL.
5. Wait until the app shows **Nimiq Pay connected**.
6. Enter a recipient Nimiq address, a positive NIM amount, and an optional purpose.
7. Tap **Review payment**. Confirm that the network reads **Nimiq Testnet**.
8. Tap **Confirm payment** and approve the native Nimiq Pay dialog.
9. You should see **Payment submitted**, then a short sequence of observation attempts.
10. The final screen is the `verifyPayment()` outcome: verified, mismatch, failed, or not verified yet.

Verification requires 60 confirmations (one Albatross batch). A brand-new testnet payment will usually land as **Payment not verified yet**. Use **Check again** after the transaction has had time to confirm. That is not a failed payment.

## Tests

```bash
npm test
```

## Production build

```bash
npm run build
```

## Network identifiers

Payment intents use an explicit network:

- `NIMIQ_TESTNET` (current default)
- `NIMIQ_MAINNET`

The generic string `"Nimiq"` is not a network. Observed `networkId` from the chain is the evidence used by verification.

## Observation

The first implementation looks up `getTransactionByHash` a few times with a pause between attempts, then stops. Public Nimiq.watch RPC is rate-limited. Retry is manual.

Observation currently runs in the frontend for this hackathon prototype. The UI talks to a `PaymentObservationService` so that lookup can later move behind a server API without changing `verifyPayment()` or the UI result types.
