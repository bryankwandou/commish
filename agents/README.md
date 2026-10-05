# Commish agents (x402 holdback)

Relayer, keeper and soak for the flow in `SPEC.md`. TypeScript, run with
`npx tsx` from the repo root (uses the root `node_modules` and the client in
`web/src/lib/commish/program.ts`). Every script logs one JSON object per line.

## Reproduce (localnet, 3 commands)

```sh
# 1. local chain with the program at its mainnet id (Windows: solana-test-validator
#    fails to unpack genesis, "Access is denied"; surfpool works offline)
surfpool start --offline --no-deploy --no-tui --no-studio --ci -y
node agents/load-program.mjs program/target/deploy/commish.so
#    (Linux/macOS alternative: solana-test-validator --reset \
#      --bpf-program CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB program/target/deploy/commish.so)

# 2. soak: 15 asserts, report in agents/out/soak-<date>.md, exit 1 on any failure
CLUSTER=localnet HOLD=40 npx tsx agents/soak.ts

# 3. agents (need agents/roles.json, see roles.example.json; soak writes
#    throwaway localnet keys to agents/keys/localnet/)
CAMPAIGN=<campaign> USDC_MINT=<mint> npx tsx agents/relayer.ts watch
npx tsx agents/keeper.ts
```

Use `program/target/deploy/commish.so` (9 KB, the pinocchio program in
`program/src/lib.rs`). `target/deploy/commish.so` (285 KB, Sep 23) is the old
Anchor build and does not match this client.

## Commands

- `relayer.ts record <sig>`: verify one payment and record_sale it.
- `relayer.ts cancel <paymentSig> <refundSig>`: cancel after a refund from the
  vault to the payer carrying memo `commish:refund:<paymentSig>`.
- `relayer.ts watch`: poll the vault's signatures, record new payments.
- `keeper.ts [once]`: release due commissions every 30 s (KEEPER pays fees).
- `soak.ts`: full flow. `CLUSTER=devnet` uses `agents/roles.json` and needs
  SOL + devnet USDC on TOOL_TREASURY, CALLER, BUYER_DESK, RELAYER, KEEPER.
  `CLUSTER=mainnet` is refused unless `CONFIRM_MAINNET=yes`.

Env: `CLUSTER`, `RPC_URL`, `RPC_URL_2` (fallback), `ROLES`, `CAMPAIGN`,
`USDC_MINT`, `PRICE`, `LEDGER`, `HOLD`, `N`, `FUND`, `POLL_MS`, `INTERVAL_MS`.

Web endpoint: import `recordPayment(cfg, sig)` / `verifyPayment(cfg, sig)` from
`agents/relayer.ts` (`configFromEnv()` builds `cfg`).
