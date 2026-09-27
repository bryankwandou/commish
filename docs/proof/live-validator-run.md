# Live validator run

Every Commish instruction and every attack below ran as a real, signed
transaction against a running Solana validator, through the same client
(`web/src/lib/commish/program.ts`) the web app uses. Re-run it with:

```bash
solana-test-validator --reset \
  --deactivate-feature B8JJXCy5amZyWG9r7EnUYLwzXSXTxG7GZ1qZ1qggo83g \
  --deactivate-feature TestFeature11111111111111111111111111111111 \
  --deactivate-feature TestFeature21111111111111111111111111111111
solana program deploy program/target/deploy/commish.so --program-id <program keypair> --max-len 9296 --url localhost
cd web && RPC_URL=http://127.0.0.1:8899 node --import tsx scripts/lifecycle.mts <payer keypair>
```

**Why the flags.** `solana-test-validator` 4.2.2 turns on every feature gate by
default, including SIMD-0500, which blocks new SBPF v0 deployments. SIMD-0500
is inactive on mainnet and devnet (checked with `solana feature status` on
2026-09-27), so the three flags make the local validator match them.

**Why not devnet.** The devnet faucet refused the deployer wallet ("airdrop
limit today") on 2026-09-27. The runtime and the program binary are the same.

**Deploy.** `solana program deploy` of the 9,296-byte binary succeeded,
signature `4P9LTb9nUS5VruEZzP6fxTNsueWsNBP2KVdcYsHrY7h3ByinRYSL7D8z4B7eQF5BLJHyDkcHGZEPQq4KkbuTTnVd`.
It cost 67,115,680 lamports at the local validator's default rent (6,960
lamports per byte); at mainnet's 5,080 the same deploy holds 0.04894 SOL plus
about 0.00007 SOL of fees.

**Setup.** A 6-decimal token stands in for USDC (the program accepts any legacy
SPL mint the campaign names). Campaign: 10% rate, 8-second refund window, an
attestor key separate from the brand.

## Result

```
cluster http://127.0.0.1:8899
program CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB
campaign EgxUYNUa8W67nqtoDeUHgGGsaCLYxaG8u3FKMFs71MWh


41 of 41 checks passed
```

| Step | Result | Signature |
| --- | --- | --- |
| setup: token mint and accounts | PASS | 66hBgfsy4jBxRtgp… |
| attack: rate above 50% | PASS (rejected: 6007 Commission rate must be between 0.01% and 50%) | - |
| create_campaign (10%, 8 s window) | PASS | 3MkpJidQ6Z16KQqj… |
| fund vault with 100 | PASS | 373vuPQDUdigDdnZ… |
| record_sale order-A (250) | PASS | 56Ra7VL69TAZ7qze… |
| record_sale order-A (250) by attestor | PASS (rejected: address already in use) | - |
| record_sale order-X (100) by stranger | PASS (rejected: 6004 Signer is not this campaign's attestor) | - |
| record_sale order-Big (2000) by attestor | PASS (rejected: 6010 Not enough unreserved budget in the vault) | - |
| record_sale order-B (100) | PASS | 36jBZWSXhpkxjc19… |
| record_sale order-C (200) | PASS | 2g8E6HP29NyoetWy… |
| record_sale order-D (50) | PASS | 44GExFSsgHdvLfRw… |
| reserved = 25 + 10 + 20 + 5 | PASS (60) | - |
| attack: withdraw 41 of 40 unreserved | PASS (rejected: 6010 Not enough unreserved budget in the vault) | - |
| attack: stranger withdraws | PASS (rejected: 6005 Signer is not this campaign's brand) | - |
| withdraw 40 unreserved | PASS | 5ry7tNqgdE6sddK8… |
| vault after withdraw | PASS (60) | - |
| attack: stranger cancels | PASS (rejected: 6004 Signer is not this campaign's attestor) | - |
| cancel order-B (refund in window) | PASS | 4iZ3q7S1sLjMwqCj… |
| attack: stranger sells creator's commission | PASS (rejected: 6013 Signer or account is not the current payee) | - |
| attack: sell above face value | PASS (rejected: 6014 Price must be above zero and at most the commission) | - |
| sell order-C for 19.40 | PASS | 4GKMRY8zLepDg3D7… |
| creator paid 19.40 today | PASS (19.4) | - |
| attack: release before window | PASS (rejected: 6011 The refund window has not closed yet) | - |
| attack: cancel after window | PASS (rejected: 6012 The refund window has already closed) | - |
| attack: release order-A to brand's account | PASS (rejected: 6013 Signer or account is not the current payee) | - |
| release order-A (anyone, no signer) | PASS | 3qHRyeJma5wtabLn… |
| attack: release order-A twice | PASS (rejected: 6003 Account is not the expected record) | - |
| attack: release sold order-C to creator | PASS (rejected: 6013 Signer or account is not the current payee) | - |
| release order-C to buyer | PASS | 4QUg43pCRWjw7M7x… |
| release order-D | PASS | 35nvMmwGPUJGsQ2g… |
| creator total = 19.40 + 25 + 5 | PASS (49.4) | - |
| buyer = 100 - 19.40 + 20 | PASS (100.6) | - |
| vault keeps the refunded 10, now unreserved | PASS (10) | - |
| withdraw the refunded 10 | PASS | 2cRaYwtveuzXCria… |
| vault empty | PASS (0) | - |
| campaign reserved = 0 | PASS (0) | - |
| campaign paid = 25 + 20 + 5 | PASS (50) | - |
| commission A account closed, rent refunded | PASS | - |
| commission B account closed, rent refunded | PASS | - |
| commission C account closed, rent refunded | PASS | - |
| commission D account closed, rent refunded | PASS | - |

41 of 41 checks passed
