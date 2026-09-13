# PROVIA

**Check before you pay. Verify after.**

PROVIA is a Nimiq Pay Mini App for independently verifying NIM payments.

Your wallet tells you a payment was sent. PROVIA checks that the payment was correct.

**Live demo:** [https://provia-cyan.vercel.app/](https://provia-cyan.vercel.app/)

Currently on **Nimiq Testnet**.

---

## What it is

PROVIA sits around a Nimiq Pay payment. It does not replace the wallet, hold funds, or treat wallet approval as proof.

It adds two independent steps:

1. **Before you send** — check that the destination is a supported Nimiq Testnet recipient.
2. **After you send** — observe the chain and verify that the payment matches a server-owned intent.

A verification record is issued only when the shared `verifyPayment()` engine returns `VERIFIED`.

## The problem

Crypto payments are irreversible. The chain will faithfully execute what you tell it to do.

If the recipient is wrong, the amount is wrong, or you are on the wrong network, the transaction can still succeed. Wallet submission is a locator, not evidence.

PROVIA does **not** detect address poisoning or burn addresses. Nimiq does not publish a protocol burn address, and a zero-balance basic account is not treated as a burn. Review shows the full stored recipient; verification compares that exact recipient on-chain.

## How it works

```text
Mini App  →  PROVIA server  →  Nimiq RPC
```

1. The Mini App checks the recipient as soon as it is entered (**preflight**).
2. Continue creates a **server-owned payment intent** with the exact recipient, amount, network, and intent ID.
3. The user approves the payment in **Nimiq Pay**.
4. The Mini App sends only `{ intentId, transactionHash }` to the server.
5. The server looks up the stored intent, observes Nimiq independently, and runs `verifyPayment()`.
6. A PROVIA verification proof is issued only if that engine returns `VERIFIED`.

**Preflight is not payment verification.** Wallet approval is not payment verification either.

## Nimiq Pay

PROVIA is a Mini App. Open it in **Nimiq Pay → Testnet → Mini Apps**.

- Try PROVIA connects through the existing Nimiq Pay provider, then opens Send NIM.
- The user confirms the payment in Nimiq Pay. PROVIA never signs or broadcasts the transaction itself.
- The wallet hash is a locator. PROVIA still has to find the transaction, match the stored intent, and wait for confirmations.

Nimiq Pay Testnet may settle `sendBasicTransactionWithData` as an HTLC payout (`fromType = 2`). That is the **sender** of the observed settlement, not the intended recipient. PROVIA accepts that path only when on-chain `recipientData` decodes exactly to `PROVIA:<serverIntentId>` and the recipient, amount, network, execution, and 60-confirmation checks still pass. Unbound HTLC payouts are rejected. Basic NIM transfers remain valid under the same rules.

## Payment flow

Home → Try PROVIA → Connect wallet → **Send NIM** → recipient check → Review → Confirm in Nimiq Pay → submitted → checking the chain → **Payment verified** / **Payment not verified**.

On Send NIM, Continue is available only after a verified recipient and a valid amount. That creates the server intent, then Review shows the locked details. Confirm in Nimiq Pay is the only send action.

## Preflight

Recipient preflight uses `getAccountByAddress` on that network’s RPC. It answers whether the destination is a supported Testnet recipient **before** Review.

It checks:

- Valid checksummed Nimiq address
- Account exists on the selected network (no silent network fallback)
- Recipient is not an HTLC, vesting, or staking account
- Recipient is not the protocol staking contract or coinbase address from `getPolicyConstants`

Passing preflight does not mean the later payment is verified.

## On-chain verification

After submission, the server observes Nimiq independently (default RPC: `https://rpc.testnet.nimiqwatch.com`) and runs `verifyPayment()`.

A payment is verified only when all of the following hold:

- The transaction executed successfully
- The intended recipient received it
- The intended amount was received
- Network and asset match the stored intent
- Confirmations ≥ **60** (one Albatross batch; inclusion depth, not protocol finality)
- Bound HTLC payouts, when used, carry exact `PROVIA:<intentId>` data
- The transaction hash has not already verified a different intent

`MIN_CONFIRMATIONS = 60`.

## Security model

| Rule | Meaning |
|---|---|
| Server-owned intent | Recipient, amount, network, and intent ID are stored before wallet approval |
| Narrow verify body | Client `/api/verify` sends only `intentId` and `transactionHash` |
| Independent observation | The server fetches the transaction; it does not trust the wallet as evidence |
| Exact match | Recipient, amount, network, and execution must match |
| 60 confirmations | Inclusion depth before `VERIFIED` |
| Intent binding | HTLC payouts must decode to `PROVIA:<serverIntentId>` |
| Replay protection | A hash that verified one intent cannot verify another |

This is an observation record, not a cryptographic certificate.

Intents, proofs, and replay reservations are **in-memory for this prototype**. Restarting the process clears them.

## Live demo

[https://provia-cyan.vercel.app/](https://provia-cyan.vercel.app/)

Open that URL in Nimiq Pay on Testnet. Because prototype state is in memory, a cold start can drop intents created before the restart.

## Run locally

Requires **Node.js 22+**.

```bash
npm install
npm run dev
```

That starts the Vite Mini App on `43123` and the verification server on `43124`. Vite proxies `/api` to the server.

Production-style local run (one Node process serving `dist/` and `/api`):

```bash
npm run build
npm start
```

Default bind: `127.0.0.1:43124`. Open the Mini App URL in **Nimiq Pay → Testnet → Mini Apps**.

| Variable | Default | Purpose |
|---|---|---|
| `NIMIQ_RPC_URL` | `https://rpc.testnet.nimiqwatch.com` | Observation RPC (Testnet) |
| `PORT` or `PROVIA_SERVER_PORT` | `43124` | Server port |
| `PROVIA_SERVER_HOST` | `127.0.0.1` | Bind address |

No environment variables are required for Testnet.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/preflight` | Check a recipient without creating an intent |
| `POST` | `/api/intents` | Create a server-owned intent (`pi_…`) |
| `GET` | `/api/intents/:intentId` | Read the stored intent |
| `POST` | `/api/verify` | Body: `{ intentId, transactionHash }` |
| `POST` | `/api/proofs` | Verify again; issue a proof only if `VERIFIED` |
| `GET` | `/api/proofs/:proofId` | Read a stored proof |
| `GET` | `/health` | Liveness |

## Testing

```bash
npm test
npm run build
```

## Current limitations

- Nimiq **Testnet** only
- Intents, proofs, and replay protection are in-memory
- No payment history, accounts, or database
- No Mainnet product path
- No address-poisoning or burn-address detection
- Verification records are observation results, not certificates
- Nimiq Pay must inject the Mini App provider (a normal browser tab cannot submit)

## Builder story

PROVIA started from a simple claim: **a successful send is not a verified payment**.

I built it as a Nimiq Pay Mini App so the check happens next to the payment, not in a separate dashboard. The architecture is Intent → Evidence → Verification → Proof. The client never supplies the expected recipient or amount at verify time. The server already has them.

The homepage explains the irreversible-payment problem. The Mini App is the product: check before you approve, then verify what actually landed on-chain.

## License

This is a student prototype submitted for the Nimiq Mini Apps Competition. Source is provided for review; a formal license file is not included in the repository.
