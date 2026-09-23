import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Commish } from "../target/types/commish";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  unpackAccount,
} from "@solana/spl-token";
import { createHash } from "crypto";
import { assert } from "chai";

const { Keypair, PublicKey, SystemProgram, Transaction } = anchor.web3;

const USDC = 1_000_000;
const HOLD = 6; // seconds — a real validator cannot have its clock warped
const BPS = 1_000; // 10%

describe("commish", () => {
  let program: Program<Commish>;
  let provider: anchor.AnchorProvider;
  let connection: anchor.web3.Connection;
  let payer: anchor.web3.Keypair;

  before(async () => {
    connection = new anchor.web3.Connection(
      process.env.ANCHOR_PROVIDER_URL ?? "http://127.0.0.1:8899",
      "confirmed",
    );
    payer = Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          require("fs").readFileSync(
            require("os").homedir() + "/.config/solana/id.json",
            "utf8",
          ),
        ),
      ),
    );
    provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(payer),
      { commitment: "confirmed" },
    );
    anchor.setProvider(provider);
    program = new anchor.Program<Commish>(
      require("../target/idl/commish.json"),
      provider,
    );
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      100 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig, "confirmed");
  });

  const send = async (
    ixs: anchor.web3.TransactionInstruction[],
    signers: anchor.web3.Keypair[] = [],
  ) => {
    const tx = new Transaction().add(...ixs);
    await provider.sendAndConfirm(tx, signers, {
      commitment: "confirmed",
      skipPreflight: false,
    });
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const expectFail = async (p: Promise<unknown>, code: string) => {
    try {
      await p;
    } catch (e: any) {
      assert.include(String(e), code);
      return;
    }
    assert.fail(`expected ${code}`);
  };

  const fund = async (to: anchor.web3.PublicKey, sol = 2) =>
    send([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: to,
        lamports: sol * anchor.web3.LAMPORTS_PER_SOL,
      }),
    ]);

  const balance = async (ata: anchor.web3.PublicKey) => {
    const acc = await connection.getAccountInfo(ata, "confirmed");
    if (!acc) return 0;
    return Number(unpackAccount(ata, acc).amount);
  };

  const orderHash = (id: string) =>
    Array.from(createHash("sha256").update(id).digest());

  // A fresh brand, mint, funded vault, attestor and joined affiliate per test.
  const setup = async (budget = 100 * USDC) => {
    const brand = Keypair.generate();
    const attestor = Keypair.generate();
    const creator = Keypair.generate();
    const mint = Keypair.generate();
    await fund(brand.publicKey);
    await fund(attestor.publicKey);
    await fund(creator.publicKey);

    const brandAta = getAssociatedTokenAddressSync(
      mint.publicKey,
      brand.publicKey,
    );
    await send(
      [
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mint.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null),
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          brandAta,
          brand.publicKey,
          mint.publicKey,
        ),
        createMintToInstruction(
          mint.publicKey,
          brandAta,
          payer.publicKey,
          1_000 * USDC,
        ),
      ],
      [mint],
    );

    const id = new BN(Math.floor(Math.random() * 1e9));
    const [campaign] = PublicKey.findProgramAddressSync(
      [Buffer.from("campaign"), brand.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
      program.programId,
    );
    const vault = getAssociatedTokenAddressSync(mint.publicKey, campaign, true);
    await send(
      [
        await program.methods
          .createCampaign(id, BPS, new BN(HOLD), attestor.publicKey)
          .accountsPartial({
            brand: brand.publicKey,
            mint: mint.publicKey,
            campaign,
            vault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
        createTransferCheckedInstruction(
          brandAta,
          mint.publicKey,
          vault,
          brand.publicKey,
          budget,
          6,
        ),
      ],
      [brand],
    );

    const [affiliate] = PublicKey.findProgramAddressSync(
      [Buffer.from("affiliate"), campaign.toBuffer(), creator.publicKey.toBuffer()],
      program.programId,
    );
    await send(
      [
        await program.methods
          .joinCampaign()
          .accountsPartial({ wallet: creator.publicKey, campaign, affiliate })
          .instruction(),
      ],
      [creator],
    );

    const commissionPda = (hash: number[]) =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("commission"), campaign.toBuffer(), Buffer.from(hash)],
        program.programId,
      )[0];

    const record = (orderId: string, amount: number, signer = attestor) => {
      const hash = orderHash(orderId);
      return program.methods
        .recordSale(hash, new BN(amount))
        .accountsPartial({
          attestor: signer.publicKey,
          campaign,
          vault,
          affiliate,
          commission: commissionPda(hash),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
        .then((ix) => send([ix], [signer]));
    };

    const creatorAta = getAssociatedTokenAddressSync(
      mint.publicKey,
      creator.publicKey,
    );
    const release = (orderId: string, wallet = creator.publicKey) =>
      program.methods
        .release()
        .accountsPartial({
          cranker: payer.publicKey,
          campaign,
          mint: mint.publicKey,
          vault,
          commission: commissionPda(orderHash(orderId)),
          affiliate,
          affiliateWallet: wallet,
          affiliateAta: getAssociatedTokenAddressSync(mint.publicKey, wallet),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .instruction()
        .then((ix) => send([ix]));

    const cancel = (orderId: string) =>
      program.methods
        .cancelCommission()
        .accountsPartial({
          attestor: attestor.publicKey,
          campaign,
          commission: commissionPda(orderHash(orderId)),
          affiliate,
        })
        .instruction()
        .then((ix) => send([ix], [attestor]));

    const withdraw = (amount: number) =>
      program.methods
        .withdraw(new BN(amount))
        .accountsPartial({
          brand: brand.publicKey,
          campaign,
          mint: mint.publicKey,
          vault,
          brandAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .instruction()
        .then((ix) => send([ix], [brand]));

    return {
      brand, attestor, creator, campaign, vault, affiliate, brandAta, creatorAta,
      record, release, cancel, withdraw,
    };
  };

  it("pays the creator 10% of the order once the refund hold has passed", async () => {
    const s = await setup();
    await s.record("order-1001", 50 * USDC);

    let c = await program.account.campaign.fetch(s.campaign);
    assert.equal(c.reserved.toNumber(), 5 * USDC);

    await expectFail(s.release("order-1001"), "StillHeld");

    await sleep((HOLD + 2) * 1000);
    await s.release("order-1001");

    assert.equal(await balance(s.creatorAta), 5 * USDC);
    c = await program.account.campaign.fetch(s.campaign);
    assert.equal(c.reserved.toNumber(), 0);
    assert.equal(c.paid.toNumber(), 5 * USDC);
    const a = await program.account.affiliate.fetch(s.affiliate);
    assert.equal(a.earned.toNumber(), 5 * USDC);
    assert.equal(a.pending.toNumber(), 0);

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
    const c = await program.account.campaign.fetch(s.campaign);
    assert.equal(c.reserved.toNumber(), 0);
  });

  it("the brand cannot withdraw money that is owed to creators", async () => {
    const s = await setup(10 * USDC);
    await s.record("order-big", 80 * USDC); // 8 USDC reserved, 2 free
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
    await expectFail(
      s.release("order-steal", Keypair.generate().publicKey),
      "WrongAffiliate",
    );
  });
});
