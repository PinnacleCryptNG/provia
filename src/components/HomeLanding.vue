<script setup lang="ts">
defineEmits<{
  start: []
}>()
</script>

<template>
  <div class="landing">
    <section class="hero panel">
      <p class="eyebrow">Independent payment verification</p>
      <h1>Send with confidence. Verify with PROVIA.</h1>
      <p class="lede">
        Crypto payments are irreversible. PROVIA checks your NIM payment before you
        approve it, then independently verifies what happened on-chain after you send it.
      </p>
      <button type="button" class="primary" @click="$emit('start')">
        Try PROVIA
      </button>
      <p class="support">Built for Nimiq. Currently on Testnet.</p>
    </section>

    <section class="block" aria-labelledby="problem-title">
      <h2 id="problem-title">A successful transaction can still be the wrong transaction.</h2>
      <div class="problem-stack">
        <p>The blockchain will faithfully execute what you tell it to do.</p>
        <p>
          If the recipient is wrong, the amount is wrong, or you're on the wrong network,
          the transaction can still succeed.
        </p>
        <p class="emphasis">And once it's confirmed, there's no undo button.</p>
      </div>
    </section>

    <section class="block" aria-labelledby="examples-title">
      <h2 id="examples-title">One mistake can cost everything.</h2>

      <figure class="example panel">
        <figcaption>
          <strong>Wrong network.</strong>
          <span>Funds sent somewhere they weren't intended to go.</span>
        </figcaption>
        <img
          src="/examples/wrong-network.jpg"
          alt="Public report of funds sent on the wrong chain and lost."
          width="701"
          height="1080"
          loading="lazy"
          decoding="async"
        />
      </figure>

      <figure class="example panel">
        <figcaption>
          <strong>Wrong address.</strong>
          <span>A single mistake can send funds to the wrong destination.</span>
        </figcaption>
        <img
          src="/examples/wrong-address.jpg"
          alt="Public report of funds sent to a burn address instead of the intended destination."
          width="720"
          height="578"
          loading="lazy"
          decoding="async"
        />
      </figure>

      <figure class="example panel">
        <figcaption>
          <strong>Address poisoning.</strong>
          <span>A familiar-looking address can lead to a completely different destination.</span>
        </figcaption>
        <img
          src="/examples/address-poisoning.jpg"
          alt="Public report of address poisoning leading to a large unintended transfer."
          width="693"
          height="1080"
          loading="lazy"
          decoding="async"
        />
        <img
          src="/examples/address-poisoning-sent.jpg"
          alt="Wallet screenshot of a succeeded transfer sent to the wrong destination after address poisoning."
          width="652"
          height="1080"
          loading="lazy"
          decoding="async"
        />
      </figure>

      <div class="coda panel">
        <p>The problem isn't that the blockchain failed.</p>
        <p class="emphasis">It did exactly what it was told.</p>
      </div>
      <p class="disclaimer">
        These examples explain the broader crypto payment problem. PROVIA does not
        detect poisoned addresses or burn addresses.
      </p>
    </section>

    <section class="block intro panel" aria-labelledby="meet-title">
      <img
        class="intro-mark"
        src="/provia-icon.png"
        alt=""
        width="48"
        height="48"
        decoding="async"
      />
      <h2 id="meet-title">Meet PROVIA</h2>
      <p class="subhead">An independent verification layer for Nimiq payments.</p>
      <p>
        PROVIA doesn't replace your wallet and doesn't hold your funds.
      </p>
      <p>
        It adds a verification step around your payment:
      </p>
      <p class="emphasis">Check before you send. Verify after you send.</p>
    </section>

    <section class="block" aria-labelledby="how-title">
      <h2 id="how-title">How does PROVIA work?</h2>

      <article class="stage panel">
        <p class="stage-label">Before the transaction</p>
        <h3>PROVIA checks the payment destination before you approve it.</h3>
        <dl class="checks">
          <div>
            <dt>Network</dt>
            <dd>Is the payment being made on the intended Nimiq network?</dd>
          </div>
          <div>
            <dt>Recipient</dt>
            <dd>Does the destination address resolve correctly?</dd>
          </div>
          <div>
            <dt>Recipient type</dt>
            <dd>Is the destination a supported recipient?</dd>
          </div>
          <div>
            <dt>Payment details</dt>
            <dd>Are the intended recipient and amount recorded correctly?</dd>
          </div>
        </dl>
        <div class="wallet-note">
          <h3>Confirm in Nimiq Pay</h3>
          <p>
            You approve the payment yourself in Nimiq Pay.
          </p>
          <p>
            PROVIA never treats wallet approval alone as proof that the payment was
            successful or correct.
          </p>
        </div>
      </article>
    </section>

    <section class="block" aria-labelledby="after-title">
      <h2 id="after-title">PROVIA checks what actually happened.</h2>
      <p class="lede">
        After the payment is submitted, PROVIA independently checks the blockchain.
      </p>
      <article class="stage panel">
        <p class="stage-label">After the transaction</p>
        <ul class="verify-list">
          <li>The transaction executed successfully.</li>
          <li>The intended recipient received the payment.</li>
          <li>The intended amount was received.</li>
          <li>The transaction reached 60 confirmations.</li>
          <li>The payment matches the verification intent.</li>
          <li>The payment hasn't already been used for another verification.</li>
        </ul>
        <div class="outcomes" aria-label="Possible verification outcomes">
          <p class="outcome verified">Payment verified</p>
          <p class="outcome mismatch">Payment not verified</p>
        </div>
        <p class="disclaimer">
          These are the outcomes PROVIA can show after it checks the chain. They are
          not a live verification on this page.
        </p>
      </article>
    </section>

    <section class="differentiator" aria-labelledby="diff-title">
      <h2 id="diff-title" class="visually-hidden">What PROVIA adds</h2>
      <p>Your wallet tells you a payment was sent.</p>
      <p class="punch">PROVIA checks that the payment was correct.</p>
    </section>

    <section class="block final panel" aria-labelledby="final-title">
      <h2 id="final-title">Before you send NIM, verify it.</h2>
      <p class="lede">
        Know what you're approving.
        Know what happened after you sent it.
      </p>
      <button type="button" class="primary" @click="$emit('start')">
        Try PROVIA
      </button>
      <p class="support">PROVIA is currently available on Nimiq Testnet.</p>
    </section>
  </div>
</template>

<style scoped>
.landing {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.hero {
  padding: 1.5rem 1.15rem 1.45rem;
}

.eyebrow,
.stage-label {
  margin: 0 0 0.55rem;
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

h1,
h2,
h3 {
  margin: 0 0 0.65rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

h1 {
  font-size: clamp(1.55rem, 7.2vw, 1.9rem);
}

h2 {
  font-size: clamp(1.28rem, 5.8vw, 1.55rem);
}

h3 {
  margin-bottom: 0.45rem;
  font-size: 1.02rem;
  letter-spacing: -0.02em;
}

.lede,
.subhead {
  margin: 0 0 1.15rem;
  color: var(--muted);
  font-size: 1.02rem;
  font-weight: 500;
}

.subhead {
  margin-bottom: 0.75rem;
  font-weight: 700;
  color: var(--text);
}

.support {
  margin: 0.7rem 0 0;
  color: var(--muted);
  font-size: 0.88rem;
  font-weight: 600;
  text-align: center;
}

.block h2 {
  margin-bottom: 0.8rem;
}

.problem-stack,
.coda {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.problem-stack p,
.coda p,
.intro p,
.wallet-note p {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--muted);
}

.problem-stack p {
  padding: 0.85rem 0.95rem;
  border-radius: 1rem;
  background: var(--surface);
  border: 1px solid rgb(213 227 240 / 90%);
  box-shadow: var(--shadow);
}

.emphasis {
  color: var(--text) !important;
  font-weight: 800 !important;
}

.example {
  margin: 0 0 0.85rem;
  padding: 0.9rem 0.85rem 0.85rem;
  overflow: hidden;
}

.example figcaption {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0 0 0.75rem;
}

.example strong {
  font-size: 1.02rem;
  font-weight: 800;
}

.example span {
  color: var(--muted);
  font-size: 0.92rem;
  font-weight: 500;
}

.example img {
  display: block;
  width: 100%;
  height: auto;
  margin: 0 0 0.65rem;
  border-radius: 0.9rem;
  border: 1px solid var(--line);
  background: var(--surface-soft);
}

.example img:last-child {
  margin-bottom: 0;
}

.coda {
  padding: 1.05rem 1.05rem 1.1rem;
}

.disclaimer {
  margin: 0.75rem 0 0;
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 500;
}

.intro {
  text-align: center;
  padding: 1.35rem 1.15rem 1.4rem;
}

.intro-mark {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 0.75rem;
  display: block;
  object-fit: contain;
}

.intro .emphasis {
  margin-top: 0.65rem;
}

.stage {
  padding: 1.15rem 1.05rem 1.2rem;
}

.checks {
  margin: 0.85rem 0 0;
}

.checks div {
  padding: 0.7rem 0;
  border-top: 1px solid var(--line);
}

.checks div:last-of-type {
  padding-bottom: 0;
}

.checks dt {
  margin: 0 0 0.2rem;
  font-size: 0.92rem;
  font-weight: 800;
}

.checks dd {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  font-weight: 500;
}

.wallet-note {
  margin: 1rem 0 0;
  padding: 0.9rem 0.9rem 0.95rem;
  border-radius: 1rem;
  background: var(--surface-soft);
  border: 1px solid var(--line);
}

.verify-list {
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
}

.verify-list li {
  position: relative;
  margin: 0 0 0.55rem;
  padding: 0 0 0 1.35rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.verify-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--primary);
  font-weight: 800;
}

.outcomes {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.55rem;
  margin: 1rem 0 0;
}

.outcome {
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-radius: 0.9rem;
  font-size: 0.95rem;
  font-weight: 800;
  text-align: center;
}

.outcome.verified {
  color: var(--verified);
  background: rgb(26 163 106 / 8%);
  border: 1px solid rgb(26 163 106 / 22%);
}

.outcome.mismatch {
  color: var(--mismatch);
  background: rgb(208 122 47 / 8%);
  border: 1px solid rgb(208 122 47 / 28%);
}

.differentiator {
  padding: 1.45rem 1.15rem 1.5rem;
  border-radius: 1.35rem;
  background: var(--primary);
  color: #fff;
  box-shadow: var(--shadow);
}

.differentiator p {
  margin: 0;
  font-size: clamp(1.12rem, 4.8vw, 1.28rem);
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.02em;
}

.differentiator .punch {
  margin-top: 0.7rem;
  font-size: clamp(1.28rem, 5.6vw, 1.5rem);
  font-weight: 800;
}

.final {
  padding: 1.4rem 1.15rem 1.35rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (min-width: 390px) {
  .outcomes {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
