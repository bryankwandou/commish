// A self-running demo shop: the server holds the brand, attestor, creator and
// early-payout desk keys, so every step can be clicked without a wallet.
import {
  Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  MINT_SIZE, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction, createMintToInstruction, createTransferCheckedInstruction,
  getAssociatedTokenAddressSync, unpackAccount,
} from "@solana/spl-token";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import * as c from "../../../pinocchio/client";

const USDC = 1_000_000;
const HOLD = Number(process.env.DEMO_HOLD ?? 30);
const DESK_FEE_BPS = 300; // the early-payout desk buys at a 3% discount
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const STATE = resolve(process.cwd(), "../.demo", RPC.includes("devnet") ? "devnet.json" : "local.json");
const PAYER = process.env.DEMO_PAYER ?? homedir() + "/.config/solana/id.json";

export const connection = new Connection(RPC, "confirmed");
const kp = (s: number[]) => Keypair.fromSecretKey(Uint8Array.from(s));
const payer = kp(JSON.parse(readFileSync(PAYER, "utf8")));

type Saved = {
  brand: number[]; attestor: number[]; creator: number[]; desk: number[]; mint: number[];
  id: string; orders: { id: string; amount: number; at: number }[];
};

const send = (ixs: TransactionInstruction[], signers: Keypair[] = []) =>
  sendAndConfirmTransaction(connection, new Transaction().add(...ixs), [payer, ...signers], {
    commitment: "confirmed",
  });

let saved: Saved | null = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
const save = () => {
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify(saved));
};

let setup: Promise<Saved> | null = null;
async function ensure(): Promise<Saved> {
  if (saved) return saved;
  setup ??= (async () => {
    const [brand, attestor, creator, desk, mint] = [0, 1, 2, 3, 4].map(() => Keypair.generate());
    if (!RPC.includes("devnet")) {
      await connection.confirmTransaction(
        await connection.requestAirdrop(payer.publicKey, 50 * LAMPORTS_PER_SOL), "confirmed");
    }
    await send([brand, attestor, creator, desk].map((k) =>
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: k.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })));
    const brandAta = getAssociatedTokenAddressSync(mint.publicKey, brand.publicKey);
    const deskAta = getAssociatedTokenAddressSync(mint.publicKey, desk.publicKey);
    const creatorAta = getAssociatedTokenAddressSync(mint.publicKey, creator.publicKey);
    await send([
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
        space: MINT_SIZE, programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null),
      ...[[brandAta, brand], [deskAta, desk], [creatorAta, creator]].map(([ata, k]) =>
        createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata as PublicKey, (k as Keypair).publicKey, mint.publicKey)),
      createMintToInstruction(mint.publicKey, brandAta, payer.publicKey, 1_000 * USDC),
      createMintToInstruction(mint.publicKey, deskAta, payer.publicKey, 500 * USDC),
    ], [mint]);
    const id = BigInt(Date.now());
    const campaign = c.campaignPda(brand.publicKey, id);
    await send([
      c.createCampaign({ brand: brand.publicKey, mint: mint.publicKey, id, bps: 1_000, hold: HOLD, attestor: attestor.publicKey }),
      createTransferCheckedInstruction(brandAta, mint.publicKey, c.vaultAta(mint.publicKey, campaign), brand.publicKey, 300 * USDC, 6),
    ], [brand]);
    await send([c.joinCampaign(creator.publicKey, campaign)], [creator]);
    saved = {
      brand: [...brand.secretKey], attestor: [...attestor.secretKey], creator: [...creator.secretKey],
      desk: [...desk.secretKey], mint: [...mint.secretKey], id: id.toString(), orders: [],
    };
    save();
    return saved;
  })().finally(() => { setup = null; });
  return setup;
}

async function ctx() {
  const s = await ensure();
  const [brand, attestor, creator, desk, mintKp] = [s.brand, s.attestor, s.creator, s.desk, s.mint].map(kp);
  const mint = mintKp.publicKey;
  const campaign = c.campaignPda(brand.publicKey, BigInt(s.id));
  const affiliate = c.affiliatePda(campaign, creator.publicKey);
  return { s, brand, attestor, creator, desk, mint, campaign, affiliate };
}

const balance = async (owner: PublicKey, mint: PublicKey) => {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const acc = await connection.getAccountInfo(ata, "confirmed");
  return acc ? Number(unpackAccount(ata, acc).amount) / USDC : 0;
};

export async function buy(amount: number) {
  const x = await ctx();
  const id = `order-${Date.now()}`;
  const sig = await send([c.recordSale({
    attestor: x.attestor.publicKey, campaign: x.campaign, mint: x.mint, affiliate: x.affiliate,
    hash: c.orderHash(id), orderAmount: Math.round(amount * USDC),
  })], [x.attestor]);
  x.s.orders.unshift({ id, amount, at: Date.now() });
  save();
  return sig;
}

export async function refund(order: string) {
  const x = await ctx();
  return send([c.cancelCommission({
    attestor: x.attestor.publicKey, campaign: x.campaign, affiliate: x.affiliate, hash: c.orderHash(order),
  })], [x.attestor]);
}

export async function cashOut(order: string) {
  const x = await ctx();
  const com = c.decodeCommission((await connection.getAccountInfo(c.commissionPda(x.campaign, c.orderHash(order))))!.data);
  const price = (com.amount * BigInt(10_000 - DESK_FEE_BPS)) / 10_000n;
  return send([c.sellCommission({
    seller: x.creator.publicKey, buyer: x.desk.publicKey, campaign: x.campaign, affiliate: x.affiliate,
    mint: x.mint, hash: c.orderHash(order), price,
  })], [x.creator, x.desk]);
}

export async function release(order: string) {
  const x = await ctx();
  const com = c.decodeCommission((await connection.getAccountInfo(c.commissionPda(x.campaign, c.orderHash(order))))!.data);
  return send([c.release({
    cranker: payer.publicKey, campaign: x.campaign, mint: x.mint, affiliate: x.affiliate,
    hash: c.orderHash(order), payee: com.payee,
  })]);
}

export async function state() {
  const x = await ctx();
  const [campAcc, affAcc] = await connection.getMultipleAccountsInfo([x.campaign, x.affiliate]);
  const camp = c.decodeCampaign(campAcc!.data);
  const aff = c.decodeAffiliate(affAcc!.data);
  const vaultAcc = await connection.getAccountInfo(camp.vault);
  const vault = Number(unpackAccount(camp.vault, vaultAcc!).amount) / USDC;
  const pdas = x.s.orders.map((o) => c.commissionPda(x.campaign, c.orderHash(o.id)));
  const coms = pdas.length ? await connection.getMultipleAccountsInfo(pdas) : [];
  const now = Math.floor(Date.now() / 1000);
  return {
    rpc: RPC.includes("devnet") ? "devnet" : RPC.includes("mainnet") ? "mainnet" : "localnet",
    program: c.PROGRAM_ID.toBase58(),
    campaign: x.campaign.toBase58(),
    vault: camp.vault.toBase58(),
    holdSeconds: Number(camp.hold),
    commissionPct: camp.bps / 100,
    deskFeePct: DESK_FEE_BPS / 100,
    budget: { vault, reserved: Number(camp.reserved) / USDC, free: vault - Number(camp.reserved) / USDC, paid: Number(camp.paid) / USDC },
    creator: { wallet: x.creator.publicKey.toBase58(), usdc: await balance(x.creator.publicKey, x.mint), pending: Number(aff.pending) / USDC, earned: Number(aff.earned) / USDC },
    desk: { wallet: x.desk.publicKey.toBase58(), usdc: await balance(x.desk.publicKey, x.mint) },
    orders: x.s.orders.map((o, i) => {
      const d = coms[i] ? c.decodeCommission(coms[i]!.data) : null;
      return {
        id: o.id, amount: o.amount,
        commission: d ? Number(d.amount) / USDC : 0,
        status: d?.status ?? "Unknown",
        soldToDesk: d ? d.payee.equals(x.desk.publicKey) : false,
        secondsLeft: d ? Math.max(0, d.releaseAt - now) : 0,
        account: pdas[i].toBase58(),
      };
    }),
  };
}
