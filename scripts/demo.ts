/**
 * End-to-end demo against whatever RPC is in RPC_URL.
 *
 * Creates a mint that stands in for USDC, a brand with a funded campaign, a
 * creator who joins it, then walks an order through: recorded, held, released.
 * Prints every signature so each step can be opened in an explorer.
 */
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import {
  getProgram, orderHash, campaignPda, affiliatePda, commissionPda, vaultAta,
} from "../app/src/anchorClient";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const USDC = 1_000_000;
const HOLD = Number(process.env.HOLD_SECONDS ?? 10);
const BPS = 1_000; // 10%

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const payer = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(readFileSync(homedir() + "/.config/solana/id.json", "utf8"))),
  );
  const program = getProgram(connection, payer);
  const provider = program.provider as anchor.AnchorProvider;

  const brand = Keypair.generate();
  const attestor = Keypair.generate();
  const creator = Keypair.generate();
  const mint = Keypair.generate();

  const send = (ixs: any[], signers: Keypair[] = []) =>
    provider.sendAndConfirm(new Transaction().add(...ixs), signers, { commitment: "confirmed" });

  console.log("funding the cast");
  await send([brand, attestor, creator].map((k) =>
    SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: k.publicKey, lamports: 0.5 * LAMPORTS_PER_SOL })));

  const brandAta = getAssociatedTokenAddressSync(mint.publicKey, brand.publicKey);
  await send([
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null),
    createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, brandAta, brand.publicKey, mint.publicKey),
    createMintToInstruction(mint.publicKey, brandAta, payer.publicKey, 1_000 * USDC),
  ], [mint]);
  console.log("stand-in USDC mint:", mint.publicKey.toBase58());

  const id = new BN(Math.floor(Math.random() * 1e9));
  const campaign = campaignPda(brand.publicKey, id);
  const vault = vaultAta(campaign, mint.publicKey);

  let sig = await send([
    await program.methods.createCampaign(id, BPS, new BN(HOLD), attestor.publicKey)
      .accountsPartial({ brand: brand.publicKey, mint: mint.publicKey, campaign, vault, tokenProgram: TOKEN_PROGRAM_ID })
      .instruction(),
    createTransferCheckedInstruction(brandAta, mint.publicKey, vault, brand.publicKey, 500 * USDC, 6),
  ], [brand]);
  console.log(`campaign ${campaign.toBase58()} funded with 500 USDC  tx ${sig}`);

  const affiliate = affiliatePda(campaign, creator.publicKey);
  sig = await send([
    await program.methods.joinCampaign()
      .accountsPartial({ wallet: creator.publicKey, campaign, affiliate }).instruction(),
  ], [creator]);
  console.log(`creator ${creator.publicKey.toBase58()} joined  tx ${sig}`);

  const hash = orderHash("demo-shop", "1001");
  const commission = commissionPda(campaign, hash);
  sig = await program.methods.recordSale(hash, new BN(120 * USDC))
    .accountsPartial({
      attestor: attestor.publicKey, campaign, vault, affiliate, commission,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([attestor]).rpc();
  console.log(`order 1001 for 120 USDC recorded, 12 USDC reserved  tx ${sig}`);

  console.log(`waiting out the ${HOLD}s refund hold`);
  await sleep((HOLD + 2) * 1000);

  const creatorAta = getAssociatedTokenAddressSync(mint.publicKey, creator.publicKey);
  sig = await program.methods.release()
    .accountsPartial({
      cranker: payer.publicKey, campaign, mint: mint.publicKey, vault, commission,
      affiliate, affiliateWallet: creator.publicKey, affiliateAta: creatorAta,
      tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    }).rpc();
  const paid = await connection.getTokenAccountBalance(creatorAta);
  console.log(`paid ${paid.value.uiAmountString} USDC to the creator  tx ${sig}`);

  writeFileSync("demo-output.json", JSON.stringify({
    programId: program.programId.toBase58(),
    mint: mint.publicKey.toBase58(),
    campaign: campaign.toBase58(),
    creator: creator.publicKey.toBase58(),
    creatorAta: creatorAta.toBase58(),
    lastSignature: sig,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
