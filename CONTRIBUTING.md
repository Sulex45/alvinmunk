# Contributing to alvinmunk

Thanks for your interest in contributing! alvinmunk is a social proof-of-people reputation game on Stellar/Soroban.

## Quick Start

```bash
# Prerequisites: Node ≥20, pnpm 9, Rust stable + wasm32 target, Stellar CLI
pnpm install                          # install JS deps
pnpm contracts:build                  # build Soroban contracts (wasm32)
pnpm contracts:test                   # run Rust contract tests
pnpm typecheck && pnpm test           # TS typecheck + vitest
pnpm dev                              # start dev server (turbo → next dev)
```

## Project Structure

```
alvinmunk/
├── apps/web/          # Next.js 14 frontend
├── packages/shared/   # Shared TS types & utilities
├── contracts/         # Soroban Rust contracts (reputation, quest_registry, rewards, registry, gate)
├── belts/             # Strategy & belt roadmaps
├── docs/              # PRD, sprints, product docs
└── scripts/           # Deploy & utility scripts
```

## Development Workflow

1. **Branch**: `feat/`, `fix/`, `chore/` prefixed branches off `main`
2. **Commits**: Conventional commits preferred (`feat:`, `fix:`, `test:`, `docs:`, `chore:`)
3. **Code style**: Prettier (JS/TS) + `cargo fmt` + `cargo clippy -D warnings` (Rust)
4. **Testing**: All tests must pass before PR — `pnpm contracts:test && pnpm test && pnpm typecheck`

## Pull Request Process

1. Open a PR against `main` with a clear description
2. Reference related issues and belt/sprint context
3. Ensure CI passes (contract tests + web typecheck/lint/test)
4. Add screenshots for UI changes
5. Update docs and README if needed

## Contract Development

- Run `cd contracts && cargo test` for contract tests
- Run `cd contracts && cargo clippy -D warnings` before committing
- Contract addresses on testnet are in `apps/web/.env.local`
- Use `scripts/deploy-testnet.sh` for fresh deploys

## Questions?

Open an issue or refer to `belts/00-strategy.md` for architectural context.

