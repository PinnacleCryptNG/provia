# PROVIA

PROVIA is a Nimiq Pay Mini App for payment verification.

Phase 2 creates a NIM payment intent, reviews it, and submits it through Nimiq Pay's official `sendBasicTransaction` method. It does not observe the chain, verify the payment, or issue a proof yet.

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
2. Long-press Settings for 10 seconds and switch to **Testnet** if you want to avoid mainnet NIM.
3. On testnet, use **Get free NIM** if the account is empty.
4. Go to Mini Apps and enter the Network URL.
5. Wait until the app shows **Nimiq Pay connected**.
6. Enter a recipient Nimiq address, a positive NIM amount, and an optional purpose.
7. Tap **Review payment**.
8. Confirm the summary, then tap **Confirm payment**.
9. Approve the native Nimiq Pay dialog.
10. You should see **Payment submitted**, a shortened transaction hash, and **Waiting for confirmation**. That is not a verification result.

If you open the app in a normal browser, it stays usable and explains that it must be opened inside Nimiq Pay.

## Tests

```bash
npm test
```

## Production build

```bash
npm run build
```
