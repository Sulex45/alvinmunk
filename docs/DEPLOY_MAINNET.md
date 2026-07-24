# alvinmunk — Mainnet Deployment Runbook (Black belt)

This is the step-by-step for taking the five Soroban contracts from testnet to **Stellar mainnet**, plus the app cutover. Mainnet moves real value and is not reversible — do not skip a gate.

> Status: prepared at Green. Run this when you reach Black (mainnet + audit/security review + 20+ mainnet users).

---

## Gate 1 — Pre-deployment verification (do not skip a box)

**Contract correctness**
- [x] Full test suite green: 57 contract tests (`cargo test`) incl. property/fuzz, + 77 web/shared. CI green on every push.
- [x] End-to-end integration test exists: `scripts/e2e-testnet.mjs` (deploy → invoke vouch/quest/tip/reward → assert state, happy + negative paths).
- [x] Storage/TTL: every contract bumps TTL on long-lived keys (`BUMP_THRESHOLD`/`BUMP_EXTEND`); daily counters use temporary storage that auto-GCs. Re-profile before deploy with `scripts/bump-ttl.sh`.
- [ ] Re-review every `require_auth`: `mint_vouch`(from), `claim_vouch`(claimer), `award_quest`(recipient + ed25519 sig), `tip`/`claim_reward`(from/to), all admin setters. Confirm no sensitive op is unauthenticated.
- [x] Cross-contract calls are read-only where they should be (`rewards`→`get_earned`, `gate`→`get_score/get_earned`) and write only via the allowlisted attester (`quest_registry`→`award_xp`).

**Security**
- [ ] Grep for `unwrap()` on user-controlled paths; prefer `?` + typed errors. (Storage `get().unwrap()` on admin-set instance keys is acceptable; document each.)
- [ ] Confirm no panic on malformed input (fuzz already covers the XP math and payout).
- [x] Integer math: XP uses `u64`, USDC uses `i128`; payout paths use registered amounts (caller can never set the amount). Re-check for any raw `+`/`-` that should be `checked_*`.
- [x] Admin ops gated by `Admin.require_auth()` on all five contracts.
- [x] USDC handled via the Stellar Asset Contract (SAC) `token::Client`, not a custom token.

**Security review (mandatory for Black — pick one)**
- [ ] Third-party audit, OR
- [ ] Mentor/team security review approved. Capture the reviewer, date, and sign-off in `deployment-log.md`.
- [ ] Run `/security-review` on the contracts branch and resolve findings before deploy.

**Operational**
- [ ] Admin + attester keys generated fresh for mainnet and held in a **hardware wallet**, never in CI secrets or `.env`.
- [x] Upgrade path: all five contracts expose admin-gated `upgrade(new_wasm_hash)`.
- [x] Emergency controls: `rewards.set_paused`, `set_daily_cap`, `set_frozen`, `set_require_funding` (turn proof-of-funding ON for mainnet).
- [ ] Write a 1-page deploy SOP: who can deploy, key custody, contract-id location.

---

## Gate 2 — Deployment mechanics

Verify the CLI and **the mainnet passphrase** (contains `Public Global Stellar Network`, NOT `Test`).

```bash
stellar --version   # install: brew install stellar-cli

stellar network add mainnet \
  --rpc-url https://mainnet.sorobanrpc.com \
  --network-passphrase "Public Global Stellar Network ; September 2015"

# Fund the deployer with real XLM first (a few XLM covers all five deploys).
stellar keys generate admin --network mainnet     # then fund from an exchange/wallet
stellar keys generate attester --network mainnet   # fund minimally
```

**USDC on mainnet:** do NOT issue your own. Use Circle's canonical mainnet USDC and its SAC address as `NEXT_PUBLIC_USDC_SAC_ID`. Verify the issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` on stellar.expert before wiring it.

**Deploy the five contracts.** The testnet script (`scripts/deploy-testnet.sh`) already builds, deploys, initializes, and cross-wires all five (reputation → quest_registry → rewards → registry → gate, plus `add_attester` and reward-table seeding). Make a `scripts/deploy-mainnet.sh` copy of it that:
1. Uses `--network mainnet`.
2. Uses the mainnet USDC SAC id (Circle), not a self-issued asset.
3. Turns `rewards.set_require_funding(true)` ON (proof-of-funding gate for real money).
4. Sets a conservative `rewards.set_daily_cap` (treasury circuit breaker).

```bash
stellar contract build   # wasm32v1-none, optimized

USDC_SAC=<circle_mainnet_usdc_sac> ADMIN=admin ATTESTER=attester \
  ./scripts/deploy-mainnet.sh
```

After deploy:
- [ ] Read a view method from each contract on mainnet RPC to confirm it responds.
- [ ] Run the e2e smoke (a single vouch + claim) against the mainnet ids with a throwaway funded account.
- [ ] Record each contract id + WASM hash + deployer fingerprint + commit SHA in `deployment-log.md` and the README.
- [ ] Open each on `stellar.expert/explorer/public/contract/<ID>` and confirm.

---

## Gate 3 — Post-deployment

**App cutover**
- [ ] In Vercel prod env, flip `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`, set the mainnet RPC/Horizon, the five mainnet contract ids, and the Circle USDC SAC id.
- [ ] The dev wallet is hard-disabled on mainnet, so passkey infra must be live: set `NEXT_PUBLIC_PASSKEY_WALLET_WASM_HASH` + the relayer secrets (already configured on Vercel).
- [ ] Remove/disable the testnet faucet route on mainnet (it already refuses when network=mainnet).
- [ ] Redeploy and smoke-test onboarding + one vouch on the live mainnet app.

**Monitoring**
- [x] Product analytics + error tracking already wired (Vercel Analytics + Speed Insights + PostHog). Add PostHog alerts on error-rate spikes.
- [ ] Add contract-event monitoring (RPC `getEvents` cron, or Mercury/Subquery) alerting on: admin ops, `set_paused`, large `reward`/`tipped` amounts.
- [ ] A simple metrics page (TVL paid, users, vouch loops/week) — even a Notion/Streamlit board.

**Advanced feature (Black requires ≥1 — already satisfied)**
- [x] **Fee Sponsorship** — gasless via the OZ Channels relayer + fee-bump (`/api/passkey-send`, `lib/wallet.ts`).
- [x] **Account Abstraction** — passkey smart wallet with secp256r1 custom auth.
- [ ] Optional second: **SEP-24/SEP-31 anchor** cross-border off-ramp (issue #1).

**Ecosystem + marketing**
- [ ] X/Twitter launch thread with the mainnet contract ids + stellar.expert links (see `docs/MARKETING.md`).
- [ ] Submit alvinmunk to the Stellar ecosystem directory (stellar.org/ecosystem) and lumenloop.com.
- [ ] Ecosystem contribution: the 26 open Wave-Program issues + a technical blog (`docs/MARKETING.md`) satisfy this.
