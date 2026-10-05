// End-to-end tests of the compiled program (target/deploy/commish.so) on
// LiteSVM. Every guarantee the program makes is written as an attack that
// must fail, next to the honest path that must succeed.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { FailedTransactionMetadata, LiteSVM, TransactionMetadata } from "litesvm";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressEncoder,
  lamports,
  pipe,
  setTransactionMessageFeePayer,
  signTransaction,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import {
  CAMPAIGN_LEN,
  COMMISSION_LEN,
  PROGRAM_ID,
  TREASURY,
  TOKEN_PROGRAM,
  cancelIx,
  commissionFor,
  createCampaignIxs,
  decodeCampaign,
  decodeCommission,
  decodeTokenAccount,
  findAta,
  orderHash,
  recordSaleIx,
  releaseIx,
  sellIx,
  withdrawIx,
} from "../../web/src/lib/commish/program.ts";

import { fileURLToPath } from "node:url";
const SO = fileURLToPath(new URL("../target/deploy/commish.so", import.meta.url));
const DAY = 86_400n;
// The attestor's HMAC secret for order hashes (fixed so test runs are repeatable).
const ATTESTOR_KEY = new Uint8Array(32).fill(7);
const USDC = (n: number) => BigInt(Math.round(n * 1_000_000));

let svm: LiteSVM;
let mint: Address;
let otherMint: Address;
let treasuryAta: Address;
const cu: Record<string, bigint> = {};

// ------------------------------------------------------------------ helpers

async function signer(): Promise<KeyPairSigner> {
  const k = await generateKeyPairSigner();
  svm.airdrop(k.address, lamports(10_000_000_000n));
  return k;
}

async function send(ixs: Instruction[], signers: KeyPairSigner[], label?: string): Promise<TransactionMetadata | FailedTransactionMetadata> {
  svm.expireBlockhash();
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signers[0].address, m),
    (m) => svm.setTransactionMessageLifetimeUsingLatestBlockhash(m),
    (m) => appendTransactionMessageInstructions(ixs, m),
  );
  const tx = await signTransaction(signers.map((s) => s.keyPair), compileTransaction(msg));
  const r = svm.sendTransaction(tx);
  if (label && r instanceof TransactionMetadata) cu[label] = r.computeUnitsConsumed();
  return r;
}

async function ok(ixs: Instruction[], signers: KeyPairSigner[], label?: string) {
  const r = await send(ixs, signers, label);
  if (r instanceof FailedTransactionMetadata) {
    assert.fail(`expected success, got ${r.err()}\n${r.meta().logs().join("\n")}`);
  }
  return r;
}

/** The transaction must fail with custom program error `code`. */
async function fails(code: number | null, ixs: Instruction[], signers: KeyPairSigner[]) {
  const r = await send(ixs, signers);
  assert.ok(r instanceof FailedTransactionMetadata, "expected the transaction to fail");
  if (code !== null) {
    const logs = r.meta().logs().join("\n");
    assert.match(logs, new RegExp(`custom program error: 0x${code.toString(16)}\\b`), logs);
  }
}

const u64 = (n: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
};

function setMint(addr: Address) {
  const d = new Uint8Array(82);
  new DataView(d.buffer).setBigUint64(36, 1_000_000_000_000n, true); // supply
  d[44] = 6; // decimals
  d[45] = 1; // initialised
  svm.setAccount({ address: addr, data: d, executable: false, lamports: lamports(svm.minimumBalanceForRentExemption(82n)), programAddress: TOKEN_PROGRAM, space: 82n });
}

/** Put a token account of `m` owned by `owner` at its ATA, holding `amount`. */
async function fund(owner: Address, amount: bigint, m: Address = mint): Promise<Address> {
  const ata = await findAta(owner, m);
  const d = new Uint8Array(165);
  const e = getAddressEncoder();
  d.set(e.encode(m), 0);
  d.set(e.encode(owner), 32);
  d.set(u64(amount), 64);
  d[108] = 1; // initialised
  svm.setAccount({ address: ata, data: d, executable: false, lamports: lamports(svm.minimumBalanceForRentExemption(165n)), programAddress: TOKEN_PROGRAM, space: 165n });
  return ata;
}

function balance(ata: Address): bigint {
  const a = svm.getAccount(ata);
  assert.ok(a.exists);
  return decodeTokenAccount(a.data)!.amount;
}

function campaignOf(addr: Address) {
  const a = svm.getAccount(addr);
  assert.ok(a.exists);
  return decodeCampaign(addr, a.data)!;
}

function commissionOf(addr: Address) {
  const a = svm.getAccount(addr);
  return a.exists ? decodeCommission(addr, a.data) : null;
}

function warp(seconds: bigint) {
  const c = svm.getClock();
  c.unixTimestamp += seconds;
  svm.setClock(c);
}

const rentCampaign = () => svm.minimumBalanceForRentExemption(BigInt(CAMPAIGN_LEN));
const rentCommission = () => svm.minimumBalanceForRentExemption(BigInt(COMMISSION_LEN));

type Setup = {
  brand: KeyPairSigner;
  attestor: KeyPairSigner;
  creator: KeyPairSigner;
  campaign: Address;
  vault: Address;
  brandAta: Address;
  creatorAta: Address;
};

/** A funded campaign: 10% commission, 7-day refund window, 1,000 USDC budget. */
async function setup(opts: { bps?: number; hold?: bigint; budget?: bigint } = {}): Promise<Setup> {
  const brand = await signer();
  const attestor = await signer();
  const creator = await signer();
  const brandAta = await fund(brand.address, USDC(5_000));
  const creatorAta = await fund(creator.address, 0n);
  const id = BigInt(Math.floor(Math.random() * 1e15));
  const { campaign, vault, instructions } = await createCampaignIxs({
    brand: brand.address,
    id,
    bps: opts.bps ?? 1_000,
    holdSeconds: opts.hold ?? 7n * DAY,
    attestor: attestor.address,
    mint,
    lamports: rentCampaign(),
  });
  await ok(instructions, [brand], "create_campaign (+ vault ATA)");
  const budget = opts.budget ?? USDC(1_000);
  const { tokenTransferIx } = await import("../../web/src/lib/commish/program.ts");
  if (budget > 0n) await ok([tokenTransferIx(brandAta, vault, brand.address, budget)], [brand]);
  return { brand, attestor, creator, campaign, vault, brandAta, creatorAta };
}

async function sale(s: Setup, orderId: string, amount: bigint, payer: KeyPairSigner = s.attestor) {
  const hash = await orderHash(s.campaign, orderId, ATTESTOR_KEY);
  const { commission, instruction } = await recordSaleIx({
    attestor: s.attestor.address,
    payer: payer.address,
    campaign: s.campaign,
    vault: s.vault,
    orderHash: hash,
    orderAmount: amount,
    creator: s.creator.address,
    lamports: rentCommission(),
  });
  return { commission, instruction, hash, signers: payer === s.attestor ? [s.attestor] : [payer, s.attestor] };
}

// -------------------------------------------------------------------- tests

before(async () => {
  svm = new LiteSVM();
  svm.addProgramFromFile(PROGRAM_ID, SO);
  mint = (await generateKeyPairSigner()).address;
  otherMint = (await generateKeyPairSigner()).address;
  setMint(mint);
  setMint(otherMint);
  treasuryAta = await fund(TREASURY, 0n);
});

describe("campaign", () => {
  test("creates a campaign whose vault is its own token account", async () => {
    const s = await setup();
    const c = campaignOf(s.campaign);
    assert.equal(c.brand, s.brand.address);
    assert.equal(c.attestor, s.attestor.address);
    assert.equal(c.mint, mint);
    assert.equal(c.vault, s.vault);
    assert.equal(c.bps, 1_000);
    assert.equal(c.holdSeconds, 7n * DAY);
    assert.equal(c.reserved, 0n);
    assert.equal(balance(s.vault), USDC(1_000));
  });

  test("rejects a rate above 50% and a window above 90 days", async () => {
    const brand = await signer();
    for (const [bps, hold, code] of [[5_001, DAY, 6007], [0, DAY, 6007], [1_000, 91n * DAY, 6008], [1_000, -1n, 6008]] as const) {
      const { instructions } = await createCampaignIxs({ brand: brand.address, id: 7n, bps, holdSeconds: hold, attestor: brand.address, mint, lamports: rentCampaign() });
      await fails(code, instructions, [brand]);
    }
  });

  test("the same brand and id cannot be created twice", async () => {
    const brand = await signer();
    const p = { brand: brand.address, id: 42n, bps: 500, holdSeconds: DAY, attestor: brand.address, mint, lamports: rentCampaign() };
    await ok((await createCampaignIxs(p)).instructions, [brand]);
    await fails(null, (await createCampaignIxs(p)).instructions, [brand]);
  });

  test("the vault must be a token account owned by the campaign", async () => {
    const brand = await signer();
    const { instructions } = await createCampaignIxs({ brand: brand.address, id: 9n, bps: 500, holdSeconds: DAY, attestor: brand.address, mint, lamports: rentCampaign() });
    // Swap the vault for the brand's own token account.
    const own = await fund(brand.address, 0n);
    const ix = instructions[1];
    const forged = { ...ix, accounts: ix.accounts!.map((a, i) => (i === 2 ? { ...a, address: own } : a)) };
    await fails(6006, [instructions[0], forged], [brand]);
  });
});

describe("recording sales", () => {
  test("a sale reserves the creator's cut on-chain", async () => {
    const s = await setup();
    const x = await sale(s, "order-1001", USDC(250));
    await ok([x.instruction], x.signers, "record_sale");
    const m = commissionOf(x.commission)!;
    assert.equal(m.amount, commissionFor(USDC(250), 1_000));
    assert.equal(m.amount, USDC(25));
    assert.equal(m.payee, s.creator.address);
    assert.equal(m.creator, s.creator.address);
    assert.equal(m.rentPayer, s.attestor.address);
    assert.equal(campaignOf(s.campaign).reserved, USDC(25));
  });

  test("the same order can never be recorded twice", async () => {
    const s = await setup();
    const x = await sale(s, "order-dup", USDC(100));
    await ok([x.instruction], x.signers);
    const again = await sale(s, "order-dup", USDC(100));
    await fails(null, [again.instruction], again.signers);
    assert.equal(campaignOf(s.campaign).reserved, USDC(10));
  });

  test("only the campaign's attestor can record a sale", async () => {
    const s = await setup();
    const mallory = await signer();
    const forged = { ...s, attestor: mallory };
    const x = await sale(forged, "order-forged", USDC(100));
    await fails(6004, [x.instruction], x.signers);
  });

  test("a separate fee payer can fund the commission account", async () => {
    const s = await setup();
    const payer = await signer();
    const x = await sale(s, "order-payer", USDC(80), payer);
    await ok([x.instruction], x.signers);
    assert.equal(commissionOf(x.commission)!.rentPayer, payer.address);
  });

  test("a sale cannot reserve more than the unreserved budget", async () => {
    const s = await setup({ budget: USDC(30) });
    const a = await sale(s, "big-1", USDC(200)); // 20 USDC
    await ok([a.instruction], a.signers);
    const b = await sale(s, "big-2", USDC(200)); // 20 more, only 10 free
    await fails(6010, [b.instruction], b.signers);
  });

  test("an order too small to earn anything is refused", async () => {
    const s = await setup({ bps: 1 });
    const x = await sale(s, "tiny", 9_999n);
    await fails(6009, [x.instruction], x.signers);
  });
});

describe("brand withdrawals", () => {
  test("the brand can take back only what is not reserved", async () => {
    const s = await setup({ budget: USDC(100) });
    const x = await sale(s, "w-1", USDC(300)); // reserves 30
    await ok([x.instruction], x.signers);
    await fails(6010, [withdrawIx({ brand: s.brand.address, campaign: s.campaign, vault: s.vault, dest: s.brandAta, amount: USDC(70.000001) })], [s.brand]);
    const before = balance(s.brandAta);
    await ok([withdrawIx({ brand: s.brand.address, campaign: s.campaign, vault: s.vault, dest: s.brandAta, amount: USDC(70) })], [s.brand], "withdraw");
    assert.equal(balance(s.brandAta) - before, USDC(70));
    assert.equal(balance(s.vault), USDC(30));
  });

  test("nobody but the brand can withdraw", async () => {
    const s = await setup();
    const mallory = await signer();
    const loot = await fund(mallory.address, 0n);
    await fails(6005, [withdrawIx({ brand: mallory.address, campaign: s.campaign, vault: s.vault, dest: loot, amount: 1n })], [mallory]);
  });
});

describe("release", () => {
  test("takes exactly 1% for the treasury, rounded down", async () => {
    const s = await setup();
    const x = await sale(s, "fee-1", USDC(123.4567)); // 12.34567 -> fee 0.123456
    await ok([x.instruction], x.signers);
    warp(7n * DAY);
    const before = balance(treasuryAta);
    await ok([releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: s.creatorAta, rentPayer: s.attestor.address })], [s.creator]);
    const amount = USDC(12.34567);
    const fee = amount / 100n;
    assert.equal(balance(treasuryAta) - before, fee);
    assert.equal(balance(s.creatorAta), amount - fee);
    assert.equal(campaignOf(s.campaign).paid, amount, "paid counts the full commission");
  });

  test("the fee cannot be redirected", async () => {
    const s = await setup();
    const x = await sale(s, "fee-2", USDC(100));
    await ok([x.instruction], x.signers);
    warp(7n * DAY);
    const mallory = await signer();
    const loot = await fund(mallory.address, 0n);
    await fails(6006, [releaseIx({ treasuryToken: loot, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: s.creatorAta, rentPayer: s.attestor.address })], [mallory]);
    const wrongMint = await fund(TREASURY, 0n, otherMint);
    await fails(6003, [releaseIx({ treasuryToken: wrongMint, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: s.creatorAta, rentPayer: s.attestor.address })], [mallory]);
  });

  test("pays the creator once the refund window closes, and refunds the rent", async () => {
    const s = await setup();
    const x = await sale(s, "r-1", USDC(500)); // 50
    await ok([x.instruction], x.signers);
    const release = releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: s.creatorAta, rentPayer: s.attestor.address });
    const cranker = await signer();
    await fails(6011, [release], [cranker]);
    warp(7n * DAY);
    const rentBefore = svm.getBalance(s.attestor.address)!;
    await ok([release], [cranker], "release");
    assert.equal(balance(s.creatorAta), USDC(49.5), "creator gets 50 minus the 1% fee");
    assert.equal(commissionOf(x.commission), null, "commission account is closed");
    assert.equal(svm.getBalance(s.attestor.address)! - rentBefore, rentCommission());
    const c = campaignOf(s.campaign);
    assert.equal(c.reserved, 0n);
    assert.equal(c.paid, USDC(50));
  });

  test("the payout cannot be redirected", async () => {
    const s = await setup();
    const x = await sale(s, "r-2", USDC(100));
    await ok([x.instruction], x.signers);
    warp(7n * DAY);
    const mallory = await signer();
    const loot = await fund(mallory.address, 0n);
    await fails(6013, [releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: loot, rentPayer: s.attestor.address })], [mallory]);
    const wrongMint = await fund(s.creator.address, 0n, otherMint);
    await fails(6003, [releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: wrongMint, rentPayer: s.attestor.address })], [mallory]);
  });

  test("the rent goes back to whoever paid it, nobody else", async () => {
    const s = await setup();
    const x = await sale(s, "r-3", USDC(100));
    await ok([x.instruction], x.signers);
    warp(7n * DAY);
    const mallory = await signer();
    await fails(6006, [releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: s.creatorAta, rentPayer: mallory.address })], [mallory]);
  });

  test("a commission cannot be paid twice", async () => {
    const s = await setup();
    const x = await sale(s, "r-4", USDC(100));
    await ok([x.instruction], x.signers);
    warp(7n * DAY);
    const release = releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: s.creatorAta, rentPayer: s.attestor.address });
    await ok([release], [s.creator]);
    await fails(null, [release], [s.creator]);
    assert.equal(balance(s.creatorAta), USDC(9.9));
  });

  test("a commission from another campaign cannot drain this vault", async () => {
    const a = await setup();
    const b = await setup();
    const x = await sale(b, "cross", USDC(100));
    await ok([x.instruction], x.signers);
    warp(7n * DAY);
    await fails(6006, [releaseIx({ treasuryToken: treasuryAta, campaign: a.campaign, vault: a.vault, commission: x.commission, payeeToken: b.creatorAta, rentPayer: b.attestor.address })], [b.creator]);
  });
});

describe("refunds", () => {
  test("a refund inside the window returns the reservation to the budget", async () => {
    const s = await setup();
    const x = await sale(s, "ref-1", USDC(400));
    await ok([x.instruction], x.signers);
    await ok([cancelIx({ attestor: s.attestor.address, campaign: s.campaign, commission: x.commission, rentPayer: s.attestor.address })], [s.attestor], "cancel");
    assert.equal(campaignOf(s.campaign).reserved, 0n);
    assert.equal(commissionOf(x.commission), null);
  });

  test("once the window has closed the commission is owed and cannot be cancelled", async () => {
    const s = await setup();
    const x = await sale(s, "ref-2", USDC(400));
    await ok([x.instruction], x.signers);
    warp(7n * DAY);
    await fails(6012, [cancelIx({ attestor: s.attestor.address, campaign: s.campaign, commission: x.commission, rentPayer: s.attestor.address })], [s.attestor]);
  });

  test("only the attestor can cancel", async () => {
    const s = await setup();
    const x = await sale(s, "ref-3", USDC(400));
    await ok([x.instruction], x.signers);
    await fails(6004, [cancelIx({ attestor: s.brand.address, campaign: s.campaign, commission: x.commission, rentPayer: s.attestor.address })], [s.brand]);
  });
});

describe("early payout", () => {
  test("a creator sells a pending commission and the buyer collects at release", async () => {
    const s = await setup();
    const x = await sale(s, "early-1", USDC(1_000)); // 100
    await ok([x.instruction], x.signers);
    const buyer = await signer();
    const buyerAta = await fund(buyer.address, USDC(500));
    const price = USDC(97); // 3% discount
    await ok([sellIx({ payee: s.creator.address, buyer: buyer.address, campaign: s.campaign, commission: x.commission, buyerToken: buyerAta, payeeToken: s.creatorAta, price })], [s.creator, buyer], "sell");
    assert.equal(balance(s.creatorAta), price, "creator is paid today");
    const m = commissionOf(x.commission)!;
    assert.equal(m.payee, buyer.address);
    assert.equal(m.creator, s.creator.address);
    assert.ok(m.sold);
    warp(7n * DAY);
    await fails(6013, [releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: s.creatorAta, rentPayer: s.attestor.address })], [buyer]);
    await ok([releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: buyerAta, rentPayer: s.attestor.address })], [buyer]);
    assert.equal(balance(buyerAta), USDC(500) - price + USDC(99));
  });

  test("only the current payee can sell, and never above face value", async () => {
    const s = await setup();
    const x = await sale(s, "early-2", USDC(1_000));
    await ok([x.instruction], x.signers);
    const buyer = await signer();
    const buyerAta = await fund(buyer.address, USDC(500));
    const mallory = await signer();
    const malloryAta = await fund(mallory.address, 0n);
    const base = { buyer: buyer.address, campaign: s.campaign, commission: x.commission, buyerToken: buyerAta };
    await fails(6013, [sellIx({ ...base, payee: mallory.address, payeeToken: malloryAta, price: USDC(90) })], [mallory, buyer]);
    await fails(6014, [sellIx({ ...base, payee: s.creator.address, payeeToken: s.creatorAta, price: USDC(100.000001) })], [s.creator, buyer]);
    await fails(6014, [sellIx({ ...base, payee: s.creator.address, payeeToken: s.creatorAta, price: 0n })], [s.creator, buyer]);
  });

  test("the buyer must pay in the campaign's own token", async () => {
    const s = await setup();
    const x = await sale(s, "early-3", USDC(1_000));
    await ok([x.instruction], x.signers);
    const buyer = await signer();
    const junk = await fund(buyer.address, USDC(500), otherMint);
    const creatorJunk = await fund(s.creator.address, 0n, otherMint);
    await fails(6003, [sellIx({ payee: s.creator.address, buyer: buyer.address, campaign: s.campaign, commission: x.commission, buyerToken: junk, payeeToken: creatorJunk, price: USDC(90) })], [s.creator, buyer]);
  });

  test("a commission that is already due cannot be sold", async () => {
    const s = await setup();
    const x = await sale(s, "early-4", USDC(1_000));
    await ok([x.instruction], x.signers);
    warp(7n * DAY);
    const buyer = await signer();
    const buyerAta = await fund(buyer.address, USDC(500));
    await fails(6012, [sellIx({ payee: s.creator.address, buyer: buyer.address, campaign: s.campaign, commission: x.commission, buyerToken: buyerAta, payeeToken: s.creatorAta, price: USDC(90) })], [s.creator, buyer]);
  });

  test("a refund after an early sale leaves the buyer with the refund risk", async () => {
    const s = await setup();
    const x = await sale(s, "early-5", USDC(1_000));
    await ok([x.instruction], x.signers);
    const buyer = await signer();
    const buyerAta = await fund(buyer.address, USDC(500));
    await ok([sellIx({ payee: s.creator.address, buyer: buyer.address, campaign: s.campaign, commission: x.commission, buyerToken: buyerAta, payeeToken: s.creatorAta, price: USDC(95) })], [s.creator, buyer]);
    await ok([cancelIx({ attestor: s.attestor.address, campaign: s.campaign, commission: x.commission, rentPayer: s.attestor.address })], [s.attestor]);
    assert.equal(balance(s.creatorAta), USDC(95), "the creator keeps the early payout");
    assert.equal(campaignOf(s.campaign).reserved, 0n);
  });
});

describe("documented behaviour", () => {
  test("anyone can trigger the release once the window closes", async () => {
    const s = await setup({ hold: 600n });
    const x = await sale(s, "order-keeper", 50_000n);
    await ok([x.instruction], x.signers);
    warp(600n);
    const keeper = await signer();
    await ok([releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: s.creatorAta, rentPayer: s.attestor.address })], [keeper]);
    assert.equal(balance(s.creatorAta), 5_000n - 50n, "creator gets 5000 minus the 1% fee");
  });

  test("finding #2: the attestor can record an order again after its commission is released", async () => {
    const s = await setup({ hold: 600n });
    const x = await sale(s, "order-again-release", 50_000n);
    await ok([x.instruction], x.signers);
    warp(600n);
    await ok([releaseIx({ treasuryToken: treasuryAta, campaign: s.campaign, vault: s.vault, commission: x.commission, payeeToken: s.creatorAta, rentPayer: s.attestor.address })], [s.creator]);
    assert.equal(commissionOf(x.commission), null);
    const again = await sale(s, "order-again-release", 50_000n);
    assert.equal(again.commission, x.commission, "same PDA");
    await ok([again.instruction], again.signers);
    assert.equal(commissionOf(x.commission)!.amount, 5_000n, "a second commission exists for the same order");
    assert.equal(campaignOf(s.campaign).reserved, 5_000n);
  });

  test("finding #2: the attestor can record an order again after its commission is cancelled", async () => {
    const s = await setup({ hold: 600n });
    const x = await sale(s, "order-again-cancel", 50_000n);
    await ok([x.instruction], x.signers);
    await ok([cancelIx({ attestor: s.attestor.address, campaign: s.campaign, commission: x.commission, rentPayer: s.attestor.address })], [s.attestor]);
    const again = await sale(s, "order-again-cancel", 50_000n);
    await ok([again.instruction], again.signers);
    assert.equal(commissionOf(x.commission)!.amount, 5_000n);
  });
});

describe("binary", () => {
  test("fits the deploy budget and reports compute units", async () => {
    const { statSync } = await import("node:fs");
    const size = statSync(SO).size;
    console.log(`\n  program binary: ${size} bytes`);
    for (const [k, v] of Object.entries(cu)) console.log(`  ${k.padEnd(30)} ${v} CU`);
    // The first deploy sized the program account at 9,296 bytes; staying under
    // it lets an upgrade reuse that account without paying to extend it.
    assert.ok(size <= 9_296, `binary is ${size} bytes; the deployed program account holds 9,296`);
  });
});
