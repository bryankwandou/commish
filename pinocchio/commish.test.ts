// The Anchor suite (tests/commish.ts), case for case, against the Pinocchio
// build — plus the early-payout cases that only the Pinocchio build has.
import {
  Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram,
  Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  MINT_SIZE, TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction,
  createMintToInstruction, createTransferCheckedInstruction,
  getAssociatedTokenAddressSync, unpackAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { readFileSync } from "fs";
import { homedir } from "os";
import * as c from "./client";

const USDC = 1_000_000;
const HOLD = 6;
const BPS = 1_000;

describe("commish (pinocchio)", () => {
  const connection = new Connection(
    process.env.RPC_URL ?? "http://127.0.0.1:8899", "confirmed",
  );
  const payer = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(readFileSync(homedir() + "/.config/solana/id.json", "utf8"))),
  );

  const send = (ixs: TransactionInstruction[], signers: Keypair[] = []) =>
    sendAndConfirmTransaction(connection, new Transaction().add(...ixs), [payer, ...signers], {
      commitment: "confirmed",
    });
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const expectFail = async (p: Promise<unknown>, code: string) => {
    try {
      await p;
    } catch (e: any) {
      const logs = (e.logs ?? e.transactionLogs ?? []).join("\n");
      const name = c.errorName(e) ?? c.errorName(logs);
      if (name) assert.equal(name, code);
      else assert.include(String(e) + logs, code);
      return;
    }
    assert.fail(`expected ${code}`);
  };
  const balance = async (ata: PublicKey) => {
    const acc = await connection.getAccountInfo(ata, "confirmed");
    return acc ? Number(unpackAccount(ata, acc).amount) : 0;
  };
  const account = async (k: PublicKey) =>
    (await connection.getAccountInfo(k, "confirmed"))!.data;

  const setup = async (budget = 100 * USDC) => {
    const [brand, attestor, creator, mint] = [0, 1, 2, 3].map(() => Keypair.generate());
    await send([brand, attestor, creator].map((k) =>
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: k.publicKey, lamports: 2 * LAMPORTS_PER_SOL })));
    const brandAta = getAssociatedTokenAddressSync(mint.publicKey, brand.publicKey);
    await send([
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
        space: MINT_SIZE, programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null),
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, brandAta, brand.publicKey, mint.publicKey),
      createMintToInstruction(mint.publicKey, brandAta, payer.publicKey, 1_000 * USDC),
    ], [mint]);

    const id = BigInt(Math.floor(Math.random() * 1e9));
    const campaign = c.campaignPda(brand.publicKey, id);
    const vault = c.vaultAta(mint.publicKey, campaign);
    await send([
      c.createCampaign({ brand: brand.publicKey, mint: mint.publicKey, id, bps: BPS, hold: HOLD, attestor: attestor.publicKey }),
      createTransferCheckedInstruction(brandAta, mint.publicKey, vault, brand.publicKey, budget, 6),
    ], [brand]);
    await send([c.joinCampaign(creator.publicKey, campaign)], [creator]);
    const affiliate = c.affiliatePda(campaign, creator.publicKey);
    const m = mint.publicKey;

    return {
      brand, attestor, creator, campaign, vault, affiliate, mint: m, payerMint: mint,
      creatorAta: getAssociatedTokenAddressSync(m, creator.publicKey),
      record: (order: string, amount: number, signer = attestor) =>
        send([c.recordSale({ attestor: signer.publicKey, campaign, mint: m, affiliate, hash: c.orderHash(order), orderAmount: amount })], [signer]),
      release: (order: string, payee = creator.publicKey) =>
        send([c.release({ cranker: payer.publicKey, campaign, mint: m, affiliate, hash: c.orderHash(order), payee })]),
      cancel: (order: string) =>
        send([c.cancelCommission({ attestor: attestor.publicKey, campaign, affiliate, hash: c.orderHash(order) })], [attestor]),
      withdraw: (amount: number) =>
        send([c.withdraw({ brand: brand.publicKey, campaign, mint: m, amount })], [brand]),
      campaignState: async () => c.decodeCampaign(await account(campaign)),
      commission: async (order: string) => c.decodeCommission(await account(c.commissionPda(campaign, c.orderHash(order)))),
    };
  };

  // A liquidity provider holding USDC of the same mint.
  const lp = async (s: Awaited<ReturnType<typeof setup>>, amount = 50 * USDC) => {
    const buyer = Keypair.generate();
    const ata = getAssociatedTokenAddressSync(s.mint, buyer.publicKey);
    await send([
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: buyer.publicKey, lamports: LAMPORTS_PER_SOL }),
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, buyer.publicKey, s.mint),
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, s.creatorAta, s.creator.publicKey, s.mint),
      createMintToInstruction(s.mint, ata, payer.publicKey, amount),
    ]);
    return { buyer, ata };
  };
  const sell = (s: Awaited<ReturnType<typeof setup>>, order: string, seller: Keypair, buyer: Keypair, price: number) =>
    send([c.sellCommission({ seller: seller.publicKey, buyer: buyer.publicKey, campaign: s.campaign, affiliate: s.affiliate, mint: s.mint, hash: c.orderHash(order), price })], [seller, buyer]);

  it("pays the creator 10% of the order once the refund hold has passed", async () => {
    const s = await setup();
    await s.record("order-1001", 50 * USDC);
    assert.equal((await s.campaignState()).reserved, BigInt(5 * USDC));
    await expectFail(s.release("order-1001"), "StillHeld");
    await sleep((HOLD + 2) * 1000);
    await s.release("order-1001");
    assert.equal(await balance(s.creatorAta), 5 * USDC);
    const camp = await s.campaignState();
    assert.equal(camp.reserved, 0n);
    assert.equal(camp.paid, BigInt(5 * USDC));
    const a = c.decodeAffiliate(await account(s.affiliate));
    assert.equal(a.earned, BigInt(5 * USDC));
    assert.equal(a.pending, 0n);
    await expectFail(s.release("order-1001"), "NotPending");
  });

  it("never records the same order twice", async () => {
    const s = await setup();
    await s.record("order-dup", 20 * USDC);
    await expectFail(s.record("order-dup", 20 * USDC), "already in use");
  });

  it("only the brand's attestor can report a sale", async () => {
    const s = await setup();
    await expectFail(s.record("order-forged", 20 * USDC, s.creator), "WrongAttestor");
  });

  it("a refunded order is cancelled and can never be paid", async () => {
    const s = await setup();
    await s.record("order-refund", 30 * USDC);
    await s.cancel("order-refund");
    await sleep((HOLD + 2) * 1000);
    await expectFail(s.release("order-refund"), "NotPending");
    assert.equal(await balance(s.creatorAta), 0);
    assert.equal((await s.campaignState()).reserved, 0n);
  });

  it("the brand cannot withdraw money that is owed to creators", async () => {
    const s = await setup(10 * USDC);
    await s.record("order-big", 80 * USDC);
    await expectFail(s.withdraw(3 * USDC), "InsufficientBudget");
    await s.withdraw(2 * USDC);
    assert.equal(await balance(s.vault), 8 * USDC);
  });

  it("a sale is refused when the unreserved budget cannot cover it", async () => {
    const s = await setup(1 * USDC);
    await expectFail(s.record("order-too-big", 20 * USDC), "InsufficientBudget");
  });

  it("the payout cannot be redirected to another wallet", async () => {
    const s = await setup();
    await s.record("order-steal", 10 * USDC);
    await sleep((HOLD + 2) * 1000);
    await expectFail(s.release("order-steal", Keypair.generate().publicKey), "WrongAffiliate");
  });

  // ---- early payout (Pinocchio build only) ----

  it("a creator sells a pending commission for cash now; the buyer is paid at release", async () => {
    const s = await setup();
    const { buyer, ata } = await lp(s);
    await s.record("order-early", 100 * USDC); // 10 USDC commission
    await sell(s, "order-early", s.creator, buyer, 9_700_000); // 3% discount
    assert.equal(await balance(s.creatorAta), 9_700_000);
    assert.isTrue((await s.commission("order-early")).payee.equals(buyer.publicKey));

    await sleep((HOLD + 2) * 1000);
    await expectFail(s.release("order-early"), "WrongAffiliate"); // creator no longer the payee
    await s.release("order-early", buyer.publicKey);
    assert.equal(await balance(ata), 50 * USDC - 9_700_000 + 10 * USDC);
    assert.equal(c.decodeAffiliate(await account(s.affiliate)).earned, BigInt(10 * USDC));
  });

  it("only the current payee can sell, and never above face value", async () => {
    const s = await setup();
    const { buyer } = await lp(s);
    const thief = Keypair.generate();
    await send([SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: thief.publicKey, lamports: LAMPORTS_PER_SOL })]);
    await s.record("order-sell", 100 * USDC);
    await expectFail(sell(s, "order-sell", thief, buyer, 5 * USDC), "NotSeller");
    await expectFail(sell(s, "order-sell", s.creator, buyer, 11 * USDC), "InsufficientBudget");
  });

  it("a refund after the sale leaves the buyer unpaid: the buyer carries the refund risk", async () => {
    const s = await setup();
    const { buyer } = await lp(s);
    await s.record("order-sold-refund", 100 * USDC);
    await sell(s, "order-sold-refund", s.creator, buyer, 9 * USDC);
    await s.cancel("order-sold-refund");
    await expectFail(s.release("order-sold-refund", buyer.publicKey), "NotPending");
    await expectFail(sell(s, "order-sold-refund", buyer, s.creator, 1 * USDC), "NotPending");
  });
});
