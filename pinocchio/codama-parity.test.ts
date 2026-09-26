// The Codama client must build exactly the instructions the hand-written
// client (exercised end-to-end by commish.test.ts) builds: same data bytes,
// same accounts, same signer/writable flags.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { AccountRole, address, createNoopSigner, type Address } from "@solana/kit";
import * as c from "./client.ts";
import * as g from "./clients/js/src/generated/index.ts";

const pk = () => Keypair.generate().publicKey;
const A = (p: PublicKey) => address(p.toBase58());
const S = (p: PublicKey) => createNoopSigner(A(p));

function same(web3: TransactionInstruction, kit: { data?: Uint8Array | ReadonlyUint8Array; accounts?: readonly { address: Address; role: AccountRole }[] }) {
  assert.deepEqual(Buffer.from(kit.data!), web3.data);
  assert.deepEqual(
    kit.accounts!.map((m) => [m.address, m.role === AccountRole.WRITABLE_SIGNER || m.role === AccountRole.READONLY_SIGNER, m.role === AccountRole.WRITABLE || m.role === AccountRole.WRITABLE_SIGNER]),
    web3.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]),
  );
}
type ReadonlyUint8Array = Readonly<Uint8Array>;

const brand = pk(), attestor = pk(), mint = pk(), wallet = pk(), buyer = pk();
const id = 42n;
const campaign = c.campaignPda(brand, id);
const vault = c.vaultAta(mint, campaign);
const affiliate = c.affiliatePda(campaign, wallet);
const hash = c.orderHash("order-1");
const commission = c.commissionPda(campaign, hash);

test("PDAs match", async () => {
  assert.equal((await g.findCampaignPda({ brand: A(brand), id }))[0], campaign.toBase58());
  assert.equal((await g.findVaultPda({ campaign: A(campaign) }))[0], vault.toBase58());
  assert.equal((await g.findAffiliatePda({ campaign: A(campaign), wallet: A(wallet) }))[0], affiliate.toBase58());
  assert.equal((await g.findCommissionPda({ campaign: A(campaign), orderHash: hash }))[0], commission.toBase58());
});

test("all seven instructions encode identically", async () => {
  const [, campaignBump] = await g.findCampaignPda({ brand: A(brand), id });
  const [, vaultBump] = await g.findVaultPda({ campaign: A(campaign) });
  const [, affiliateBump] = await g.findAffiliatePda({ campaign: A(campaign), wallet: A(wallet) });
  same(c.createCampaign({ brand, mint, id, bps: 1000, hold: 30, attestor }), g.getCreateCampaignInstruction({
    brand: S(brand), mint: A(mint), campaign: A(campaign), vault: A(vault),
    id, commissionBps: 1000, holdSeconds: 30n, attestor: A(attestor), campaignBump, vaultBump,
  }));
  same(c.joinCampaign(wallet, campaign), g.getJoinCampaignInstruction({ wallet: S(wallet), campaign: A(campaign), affiliate: A(affiliate), affiliateBump }));
  same(c.recordSale({ attestor, campaign, mint, affiliate, hash, orderAmount: 250_000_000n }), g.getRecordSaleInstruction({
    attestor: S(attestor), campaign: A(campaign), vault: A(vault), affiliate: A(affiliate), commission: A(commission), orderHash: hash, orderAmount: 250_000_000n,
  }));
  same(c.cancelCommission({ attestor, campaign, affiliate, hash }), g.getCancelCommissionInstruction({
    attestor: S(attestor), campaign: A(campaign), commission: A(commission), affiliate: A(affiliate),
  }));
  same(c.release({ cranker: brand, campaign, mint, affiliate, hash, payee: wallet }), g.getReleaseInstruction({
    cranker: S(brand), campaign: A(campaign), mint: A(mint), vault: A(vault), commission: A(commission), affiliate: A(affiliate),
    payee: A(wallet), payeeToken: A(getAssociatedTokenAddressSync(mint, wallet, true)),
  }));
  same(c.withdraw({ brand, campaign, mint, amount: 5n }), g.getWithdrawInstruction({
    brand: S(brand), campaign: A(campaign), mint: A(mint), vault: A(vault), brandToken: A(getAssociatedTokenAddressSync(mint, brand)), amount: 5n,
  }));
  same(c.sellCommission({ seller: wallet, buyer, campaign, affiliate, mint, hash, price: 9n }), g.getSellCommissionInstruction({
    seller: S(wallet), buyer: S(buyer), campaign: A(campaign), commission: A(commission), affiliate: A(affiliate), mint: A(mint),
    buyerToken: A(getAssociatedTokenAddressSync(mint, buyer)), sellerToken: A(getAssociatedTokenAddressSync(mint, wallet)), price: 9n,
  }));
});

test("account decoders agree", () => {
  const raw = new Uint8Array(164); raw[0] = 1; raw.set(brand.toBuffer(), 1); raw.set([0xe8, 0x03], 105);
  const d = g.getCampaignDecoder().decode(raw);
  assert.equal(d.brand, brand.toBase58());
  assert.equal(d.commissionBps, c.decodeCampaign(Buffer.from(raw)).bps);
});
