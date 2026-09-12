<script setup lang="ts">
defineProps<{
  isConnecting?: boolean
}>()

defineEmits<{
  start: []
}>()
</script>

<template>
  <div class="landing">
    <section class="hero">
      <div class="shell hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">Independent payment verification</p>
          <h1>
            Send with confidence.<br />
            Verify with PROVIA.
          </h1>
          <p class="lede">
            Crypto payments are irreversible. PROVIA checks your NIM payment before you
            approve it, then independently verifies what happened on-chain after you send it.
          </p>
          <div class="hero-actions">
            <button type="button" class="primary cta" :disabled="isConnecting" @click="$emit('start')">
              Try PROVIA
            </button>
            <p class="support">Built for Nimiq. Currently on Testnet.</p>
          </div>
        </div>

        <aside class="hero-visual" aria-hidden="true">
          <div class="concept">
            <img class="concept-mark" src="/provia-icon.png" alt="" width="56" height="56" />
            <p class="concept-kicker">Around every payment</p>
            <ol class="concept-flow">
              <li>
                <span>1</span>
                <strong>Check</strong>
                <em>Before you approve</em>
              </li>
              <li>
                <span>2</span>
                <strong>Approve</strong>
                <em>In Nimiq Pay</em>
              </li>
              <li>
                <span>3</span>
                <strong>Verify</strong>
                <em>On-chain, independently</em>
              </li>
            </ol>
            <p class="concept-note">A concept of the flow — not live payment data.</p>
          </div>
        </aside>
      </div>
    </section>

    <section class="problem" aria-labelledby="problem-title">
      <div class="shell">
        <p class="eyebrow">The problem</p>
        <h2 id="problem-title">A successful transaction can still be the wrong transaction.</h2>
        <div class="problem-lead">
          <p>The blockchain will faithfully execute what you tell it to do.</p>
          <p>
            If the recipient is wrong, the amount is wrong, or you're on the wrong network,
            the transaction can still succeed. And once it's confirmed, there's no undo button.
          </p>
        </div>

        <h3 class="examples-kicker">One mistake can cost everything.</h3>
        <div class="examples">
          <figure>
            <figcaption>
              <strong>Wrong network</strong>
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
          <figure>
            <figcaption>
              <strong>Wrong address</strong>
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
          <figure class="poisoning">
            <figcaption>
              <strong>Address poisoning</strong>
              <span>A familiar-looking address can lead to a completely different destination.</span>
            </figcaption>
            <div class="pair">
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
            </div>
          </figure>
        </div>
        <p class="disclaimer">
          These examples explain the broader crypto payment problem. PROVIA does not
          detect poisoned addresses or burn addresses.
        </p>
      </div>
    </section>

    <section class="statement" aria-labelledby="statement-title">
      <div class="shell statement-inner">
        <h2 id="statement-title">
          The problem isn't that the blockchain failed.
          <span>It did exactly what it was told.</span>
        </h2>
      </div>
    </section>

    <section class="meet" aria-labelledby="meet-title">
      <div class="shell meet-grid">
        <img class="meet-mark" src="/provia-icon.png" alt="" width="88" height="88" decoding="async" />
        <div>
          <h2 id="meet-title">Meet PROVIA</h2>
          <p class="subhead">An independent verification layer for Nimiq payments.</p>
          <p>PROVIA doesn't replace your wallet and doesn't hold your funds.</p>
          <p class="meet-line">Check before you send. Verify after you send.</p>
        </div>
      </div>
    </section>

    <section class="how" aria-labelledby="how-title">
      <div class="shell">
        <p class="eyebrow">The flow</p>
        <h2 id="how-title">How does PROVIA work?</h2>
        <ol class="path" aria-label="PROVIA payment path">
          <li>Check</li>
          <li>Approve</li>
          <li>Verify</li>
        </ol>

        <div class="stages">
          <article>
            <p class="stage-label">Before you send</p>
            <h3>PROVIA checks the payment destination before you approve it.</h3>
            <ul class="ticks">
              <li>
                <strong>Network</strong>
                <span>Is the payment being made on the intended Nimiq network?</span>
              </li>
              <li>
                <strong>Recipient</strong>
                <span>Does the destination address resolve correctly?</span>
              </li>
              <li>
                <strong>Recipient type</strong>
                <span>Is the destination supported?</span>
              </li>
              <li>
                <strong>Payment details</strong>
                <span>Are the intended recipient and amount recorded correctly?</span>
              </li>
            </ul>
          </article>

          <article class="approve">
            <p class="stage-label">Confirm in Nimiq Pay</p>
            <h3>You approve the payment yourself in Nimiq Pay.</h3>
            <p>
              PROVIA never treats wallet approval alone as proof that the payment was
              successful or correct.
            </p>
          </article>

          <article>
            <p class="stage-label">After you send</p>
            <h3>PROVIA independently checks the blockchain.</h3>
            <ul class="ticks">
              <li><strong>Transaction executed successfully</strong></li>
              <li><strong>Intended recipient received the payment</strong></li>
              <li><strong>Intended amount was received</strong></li>
              <li><strong>60 confirmations reached</strong></li>
              <li><strong>Payment matches the verification intent</strong></li>
              <li><strong>Payment has not already been used for another verification</strong></li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section class="outcomes-section" aria-labelledby="outcomes-title">
      <div class="shell">
        <p class="eyebrow">After verification</p>
        <h2 id="outcomes-title">Two possible outcomes</h2>
        <p class="lede tight">
          These are explanatory examples of what PROVIA can conclude. They are not live
          verification controls on this page.
        </p>
        <div class="outcomes" aria-label="Explanatory verification outcomes">
          <article class="result verified" aria-label="Explanatory example: verified">
            <p class="result-kicker">Verified</p>
            <h3>Payment verified</h3>
            <ul>
              <li>Recipient <span>✓</span></li>
              <li>Amount <span>✓</span></li>
              <li>Intent <span>✓</span></li>
              <li>60 confirmations <span>✓</span></li>
            </ul>
          </article>
          <article class="result mismatch" aria-label="Explanatory example: not verified">
            <p class="result-kicker">Not verified</p>
            <h3>Payment not verified</h3>
            <p>Expected payment details do not match the transaction.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="differentiator" aria-labelledby="diff-title">
      <div class="shell">
        <h2 id="diff-title" class="visually-hidden">What PROVIA adds</h2>
        <p>Your wallet tells you a payment was sent.</p>
        <p class="punch">PROVIA checks that the payment was correct.</p>
      </div>
    </section>

    <section class="final" aria-labelledby="final-title">
      <div class="shell final-inner">
        <h2 id="final-title">Before you send NIM, verify it.</h2>
        <p class="lede">
          Know what you're approving.<br />
          Know what happened after you sent it.
        </p>
        <button type="button" class="primary cta" :disabled="isConnecting" @click="$emit('start')">
          Try PROVIA
        </button>
        <p class="support">PROVIA is currently available on Nimiq Testnet.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing {
  width: 100%;
  overflow-x: hidden;
}

.shell {
  width: min(72rem, 100%);
  margin: 0 auto;
  padding-inline: max(1.1rem, env(safe-area-inset-left, 0px)) max(1.1rem, env(safe-area-inset-right, 0px));
}

.eyebrow,
.stage-label,
.result-kicker,
.concept-kicker {
  display: block;
  width: 100%;
  margin: 0 0 0.7rem;
  color: var(--primary);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2,
h3 {
  margin: 0;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.12;
}

h1 {
  font-size: clamp(2rem, 8vw, 4.35rem);
}

h2 {
  font-size: clamp(1.55rem, 4.6vw, 2.75rem);
}

h3 {
  font-size: 1.12rem;
  letter-spacing: -0.03em;
  line-height: 1.25;
}

.lede,
.subhead,
.problem-lead p,
.approve p,
.meet p {
  margin: 0.9rem 0 0;
  color: var(--muted);
  font-size: clamp(1rem, 2.1vw, 1.18rem);
  font-weight: 500;
  max-width: 38rem;
}

.lede.tight {
  margin-bottom: 1.5rem;
}

.support {
  margin: 0.75rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 600;
}

.cta {
  width: 100%;
  max-width: 19rem;
  margin-top: 1.15rem;
}

.hero {
  padding: 1.4rem 0 2.4rem;
}

.hero-grid {
  display: grid;
  gap: 1.75rem;
}

.hero-actions {
  margin-top: 0.35rem;
}

.hero-visual {
  min-width: 0;
}

.concept {
  position: relative;
  padding: 1.25rem 1.15rem 1.2rem;
  border-radius: 1.5rem;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 92%), rgb(247 251 255 / 88%));
  border: 1px solid rgb(213 227 240 / 90%);
  box-shadow: var(--shadow);
}

.concept::before {
  content: '';
  position: absolute;
  inset: -18% -8% auto auto;
  width: 10rem;
  height: 10rem;
  border-radius: 50%;
  background: rgb(5 130 202 / 12%);
  pointer-events: none;
}

.concept-mark {
  position: relative;
  width: 3.25rem;
  height: 3.25rem;
  margin-bottom: 0.7rem;
  object-fit: contain;
}

.concept-flow {
  position: relative;
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.concept-flow li {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 0.7rem;
  align-items: baseline;
}

.concept-flow span {
  grid-row: 1 / span 2;
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  display: grid;
  place-items: center;
}

.concept-flow strong {
  font-size: 1rem;
}

.concept-flow em {
  color: var(--muted);
  font-size: 0.88rem;
  font-style: normal;
  font-weight: 500;
}

.concept-note {
  position: relative;
  margin: 0.95rem 0 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 500;
}

.problem {
  padding: 2.4rem 0 2.6rem;
  background: rgb(255 255 255 / 42%);
}

.problem-lead {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.1rem;
  max-width: 46rem;
}

.examples-kicker {
  margin: 2rem 0 1rem;
  font-size: clamp(1.15rem, 3vw, 1.45rem);
}

.examples {
  display: grid;
  gap: 1.15rem;
}

.examples figure {
  margin: 0;
  min-width: 0;
}

.examples figcaption {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0 0 0.7rem;
}

.examples strong {
  font-size: 1.05rem;
}

.examples span {
  color: var(--muted);
  font-size: 0.92rem;
  font-weight: 500;
}

.examples img {
  display: block;
  width: 100%;
  height: 16.5rem;
  object-fit: cover;
  object-position: top center;
  border-radius: 1.1rem;
  border: 1px solid var(--line);
  background: var(--surface);
}

.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.pair img {
  height: 16.5rem;
}

.disclaimer {
  margin: 1.1rem 0 0;
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 500;
  max-width: 42rem;
}

.statement {
  padding: 3.4rem 0 3.6rem;
}

.statement-inner {
  max-width: 58rem;
}

.statement h2 {
  font-size: clamp(1.7rem, 6vw, 3.3rem);
  font-weight: 700;
  line-height: 1.18;
}

.statement span {
  display: block;
  margin-top: 0.8rem;
  color: var(--primary);
}

.meet {
  padding: 2.4rem 0 2.8rem;
  background: rgb(255 255 255 / 48%);
}

.meet-grid {
  display: grid;
  gap: 1.1rem;
  align-items: center;
}

.meet-mark {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: contain;
}

.meet-line {
  margin-top: 1rem !important;
  color: var(--text) !important;
  font-size: clamp(1.15rem, 3vw, 1.55rem) !important;
  font-weight: 800 !important;
}

.how {
  padding: 2.6rem 0 3rem;
}

.path {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  margin: 1.35rem 0 1.6rem;
  padding: 0;
  list-style: none;
  max-width: 28rem;
}

.path li {
  padding: 0.45rem 0.35rem;
  border-radius: 999px;
  background: rgb(5 130 202 / 10%);
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
}

.stages {
  display: grid;
  gap: 1.35rem;
}

.stages article {
  min-width: 0;
}

.stages h3 {
  margin: 0 0 0.85rem;
}

.ticks {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ticks li {
  position: relative;
  margin: 0 0 0.85rem;
  padding: 0 0 0 1.45rem;
}

.ticks li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--primary);
  font-weight: 800;
}

.ticks strong {
  display: block;
  font-size: 0.98rem;
}

.ticks span {
  display: block;
  margin-top: 0.15rem;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 500;
}

.approve {
  padding: 1.15rem 1.05rem 1.2rem;
  border-radius: 1.25rem;
  background: var(--surface);
  border: 1px solid var(--line);
}

.outcomes-section {
  padding: 2.4rem 0 2.8rem;
  background: rgb(255 255 255 / 42%);
}

.outcomes {
  display: grid;
  gap: 1rem;
}

.result {
  margin: 0;
  padding: 1.2rem 1.15rem 1.25rem;
  border-radius: 1.25rem;
  border: 1px solid var(--line);
  background: var(--surface);
}

.result h3 {
  margin-bottom: 0.75rem;
}

.result ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.result li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0;
  border-top: 1px solid var(--line);
  font-size: 0.95rem;
}

.result li span {
  color: var(--verified);
  font-weight: 800;
}

.result.verified {
  border-color: rgb(26 163 106 / 24%);
}

.result.mismatch {
  border-color: rgb(208 122 47 / 28%);
}

.result.mismatch p {
  margin: 0;
  color: var(--muted);
  font-size: 0.98rem;
  font-weight: 500;
}

.differentiator {
  padding: 3.6rem 0 3.8rem;
  background: var(--primary);
  color: #fff;
}

.differentiator .eyebrow,
.differentiator p {
  color: #fff;
}

.differentiator p {
  margin: 0;
  max-width: 18ch;
  font-size: clamp(1.45rem, 4.8vw, 2.7rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.04em;
}

.differentiator .punch {
  margin-top: 1rem;
  max-width: 16ch;
  font-weight: 800;
}

.final {
  padding: 3rem 0 1.5rem;
}

.final-inner {
  max-width: 40rem;
}

.final .cta {
  display: block;
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

@media (min-width: 32rem) {
  .cta {
    width: auto;
    min-width: 11.5rem;
    padding-inline: 1.35rem;
  }

  .path {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-width: 28rem;
  }
}

@media (min-width: 48rem) {
  .hero {
    padding: 2.4rem 0 3.6rem;
  }

  .hero-grid,
  .meet-grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.85fr);
    gap: 2.4rem;
    align-items: center;
  }

  .meet-grid {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1.6rem;
  }

  .examples {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
  }

  .examples img,
  .pair img {
    height: 18.5rem;
  }

  .stages {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.8rem;
  }

  .outcomes {
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  .statement {
    padding: 5rem 0;
  }

  .differentiator {
    padding: 5.2rem 0 5.4rem;
  }

  .differentiator p {
    max-width: 22ch;
  }
}

@media (min-width: 72rem) {
  h1 {
    font-size: 4.5rem;
  }

  .hero-grid {
    gap: 4rem;
  }
}
</style>
