# PROVIA

PROVIA is a Nimiq Pay Mini App for payment verification.

Phase 1 only initializes the Nimiq provider and lets you request a Nimiq address. It does not send payments, talk to EVM chains, or issue proofs yet.

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
2. Go to Mini Apps.
3. Enter the Network URL.
4. Wait until the provider is ready, then tap **Connect Nimiq Pay**.
5. Approve the native account-sharing dialog.

If you open the app in a normal browser, it stays usable and explains that it must be opened inside Nimiq Pay.

## Production build

```bash
npm run build
```

## Testnet NIM

To avoid using real funds in later phases, long-press the Nimiq Pay settings button for 10 seconds and switch to Testnet. That switch only affects Nimiq provider operations.
