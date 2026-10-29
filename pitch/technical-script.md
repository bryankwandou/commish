# Technical script (max 2:45)

Spoken. No music. Screen: code, explorer, terminal.

**0:00-0:15 (face)**
I'm Bryan. This is the technical walk-through of Commish, a USDC holdback for x402 payments on Solana. First users are agents. Humans are not in this loop.

**0:15-0:45 (accounts)**
The program is Pinocchio, live on mainnet at CmSHpw9Q. Three account kinds. A campaign holds the rate, the hold window and the attestor. The vault is a USDC token account owned by the campaign. A commission is one account per order hash, holding amount, payee and release time. The order hash is sha256 of "commish x402", the campaign and the payment signature.

**0:45-1:15 (six instructions)**
Six instructions. create_campaign, by the tool treasury: rate up to fifty percent, hold up to ninety days. record_sale, by the relayer: reserves the router's cut. cancel, by the relayer, only inside the window. release, by anyone, only after it, minus a one percent fee. withdraw, by the treasury, only the unreserved part. sell, signed by payee and buyer: the buyer pays now and becomes the payee.

**1:15-1:40 (relayer trust model)**
The relayer is a trusted attestor. It checks the USDC payment on chain: mint, destination is the vault, amount, memo ref. Then it records. A compromised relayer can reserve fake commissions, bounded by the vault balance. It cannot move funds, cannot cancel late, cannot release early.

**1:40-1:55 (test: cannot withdraw reserved)**
Here is the test where the treasury tries to withdraw more than the unreserved budget. It fails. All thirty-four LiteSVM tests run against the compiled binary.

**1:55-2:20 (replay result)**
Now a weakness we found ourselves. Release and cancel close the commission account, so the same order hash can be recorded again. Two tests marked KNOWN prove it. The fix is in the relayer: it refuses a payment whose commission address has any transaction history, and keeps a ledger of processed signatures.

**2:20-2:35 (keeper)**
Release needs no signer except a fee payer. This keeper pays the fee, the router gets paid, the account rent goes back to whoever paid it.

**2:35-2:45 (face)**
The upgrade key is a single key today. Code and tests are open. Any agent can pay this.
