# alvinmunk — Marketing kit (Black / Master belt)

Ready-to-post launch content. The X thread and the technical blog together satisfy the Black-belt "social media promotion" and "ecosystem contribution" requirements.

---

## 1. X / Twitter launch thread

Post as a thread. Attach the demo video to tweet 1 and a screenshot to 2–3. Tag `@StellarOrg` and use `#Stellar #Soroban`. No hard sells, just the story.

**1/**
Meet alvinmunk. Collect people, not points.
It is a social reputation game on Stellar where you earn on-chain reputation by vouching for real humans, and that reputation is actually spendable in USDC.
Live: alvinmunk.vercel.app
[attach demo video]

**2/**
The problem: web3 reputation apps are graveyards of one-time mints. Easy to farm, no reason to come back, and the reputation is not portable anywhere.
alvinmunk flips it. Your reputation is made of other people, not a résumé you carry around.

**3/**
The loop is simple. You vouch for someone, even before they join. You get a share link. That link is the invite. When they claim it, you both earn Social XP, saved on-chain. Every vouch names a real person, so the app grows by people pulling in the people they trust.

**4/**
Two kinds of points, on purpose.
Social XP is clout and can never be cashed.
Earned XP comes only from verified quests and is the only track that unlocks USDC.
Sybils can farm clout all day. They never touch the treasury.

**5/**
Why Stellar. Sub-cent fees mean every vouch can be its own on-chain record. Passkey smart wallets give Face ID onboarding with no seed phrase and no gas. And USDC plus anchors mean reputation cashes out to local currency through SEP-24.

**6/**
Under the hood: five Soroban contracts that call each other, a canonical append-only attestation event any app can read, and no standing backend. The app reads chain events directly over RPC. 134 passing tests and green CI.

**7/**
It is fully responsive, fee-sponsored, and account-abstracted with passkeys. Onboarding takes seconds and the user never sees gas.
[attach mobile + wallet screenshots]

**8/**
Built through the Stellar Journey to Mastery program: White, Yellow, and Orange belts cleared, idea approved, now shipping the production MVP.
Code is open: github.com/mericcintosun/alvinmunk

**9/**
If you build wallets, anchors, or communities on Stellar and want a portable, sybil-resistant proof-of-people signal, let us talk.
Try it, vouch for someone, and light a star. alvinmunk.vercel.app
#Stellar #Soroban

---

## 2. Technical blog draft

**Title:** How we built a sybil-resistant proof-of-people reputation on Stellar

**Suggested home:** dev.to / Hashnode / Medium, cross-posted to the repo as `docs/blog/`.

### Intro
Most on-chain reputation is either a self-issued résumé or a pile of one-time mints that bots farm in minutes. We wanted something different: reputation that is made of other people, is expensive to fake, and is actually spendable. This post walks through the three ideas that made alvinmunk work on Stellar.

### 1. The cold-start problem, and the async vouch
A solo builder cannot ask two people to stand next to each other and tap. So the core action is a one-sided, asynchronous vouch. You pick someone, write one line, and mint a half-card bound to `sha256(secret)`. You never enter their address. The claim-secret rides in the share link fragment, which browsers never send to a server. Whoever opens the link binds their own address at claim time. Two consequences: the link is the install funnel, and rings cannot be pre-computed because the minter does not know the claimer.

Code: `contracts/reputation/src/lib.rs` (`mint_vouch`, `claim_vouch`), `apps/web/src/lib/reputation.ts`.

### 2. Separating money from fun (the two-track model)
The lethal version of this product pays both sides of a free, self-initiable vouch in cashable value. That is a money printer for sybils. So we split reputation into two tracks. Social XP comes from vouches and is never cashable. Earned XP comes only from attester-verified quests and is the only track the rewards contract reads. On top of that: first-pair-only rewards, per-day caps, an XP stake that is slashed if a vouch is never claimed, a second-order gate that only pays the voucher after the claimer does something verified, and a proof-of-funding gate plus a treasury circuit breaker on the payout side. The result: sybils can farm clout, but every cashable dollar is gated and, at scale, backed by real revenue.

Code: the `Social`/`Earned` split in `reputation`, and `rewards` reading only `get_earned`.

### 3. No seed phrase, no gas, no backend
Onboarding uses passkey smart wallets (secp256r1) through passkey-kit, and every contract call is fee-sponsored and fee-bumped through an OpenZeppelin Channels relayer. The user signs with Face ID and never holds XLM. On the read side there is no standing backend: the leaderboard, activity feed, and profiles all read Soroban events directly over RPC. The only server-side secret is a single serverless attester that verifies off-chain evidence and signs it, with the contract verifying that signature on-chain.

Code: `apps/web/src/lib/wallet.ts`, `apps/web/src/app/api/passkey-send/route.ts`, `apps/web/src/app/api/attest/route.ts`.

### Closing
The canonical `att_set` event is emitted from day one, append-only, so the reputation becomes a signal any anchor or app can read without us building a second write path. That is the long game: a portable proof-of-people primitive on Stellar. Code is open at github.com/mericcintosun/alvinmunk.

---

## 3. Ecosystem checklist (Black)
- [ ] Post the X thread above, tag @StellarOrg.
- [ ] Publish the blog, link it in the README.
- [ ] Submit to stellar.org/ecosystem and lumenloop.com.
- [ ] The 26 open Wave-Program issues count as an open-source ecosystem contribution.
