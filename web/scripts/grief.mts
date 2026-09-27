// Pre-funding check: can a stranger block record_sale by sending lamports to
// the commission address before the sale is recorded?
import { readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { address, type Instruction } from "@solana/kit";
import * as C from "../src/lib/commish/program.ts";
const cx = new Connection("http://127.0.0.1:8899", "confirmed");
const brand = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.argv[2], "utf8"))));
const stranger = Keypair.generate();
await cx.confirmTransaction(await cx.requestAirdrop(stranger.publicKey, 1e9), "confirmed");
const a = (k: Keypair | PublicKey) => address(("publicKey" in k ? k.publicKey : k).toBase58());
const w = (ix: Instruction) => new TransactionInstruction({ programId: new PublicKey(ix.programAddress), keys: (ix.accounts ?? []).map((m) => ({ pubkey: new PublicKey(m.address), isWritable: (m.role & 1) === 1, isSigner: (m.role & 2) === 2 })), data: Buffer.from(ix.data ?? new Uint8Array()) });
const TOKEN = new PublicKey(C.TOKEN_PROGRAM), mintKp = Keypair.generate(), mint = a(mintKp);
const brandAta = await C.findAta(a(brand), mint);
const d = Buffer.alloc(9); d[0] = 7; d.writeBigUInt64LE(100_000_000n, 1);
await sendAndConfirmTransaction(cx, new Transaction().add(
  SystemProgram.createAccount({ fromPubkey: brand.publicKey, newAccountPubkey: mintKp.publicKey, lamports: await cx.getMinimumBalanceForRentExemption(82), space: 82, programId: TOKEN }),
  new TransactionInstruction({ programId: TOKEN, keys: [{ pubkey: mintKp.publicKey, isSigner: false, isWritable: true }], data: Buffer.concat([Buffer.from([20, 6]), brand.publicKey.toBuffer(), Buffer.from([0])]) }),
  w(C.createAtaIx(a(brand), brandAta, a(brand), mint)),
  new TransactionInstruction({ programId: TOKEN, keys: [{ pubkey: mintKp.publicKey, isSigner: false, isWritable: true }, { pubkey: new PublicKey(brandAta), isSigner: false, isWritable: true }, { pubkey: brand.publicKey, isSigner: true, isWritable: false }], data: d })), [brand, mintKp]);
const cc = await C.createCampaignIxs({ brand: a(brand), id: C.randomCampaignId(), bps: 1000, holdSeconds: 60n, attestor: a(brand), mint, lamports: BigInt(await cx.getMinimumBalanceForRentExemption(C.CAMPAIGN_LEN)) });
await sendAndConfirmTransaction(cx, new Transaction().add(...cc.instructions.map(w), w(C.tokenTransferIx(brandAta, cc.vault, a(brand), 50_000_000n))), [brand]);
const hash = await C.orderHash(cc.campaign, "4822"); // the shop's next sequential order id
const { commission } = await C.recordSaleIx({ attestor: a(brand), payer: a(brand), campaign: cc.campaign, vault: cc.vault, orderHash: hash, orderAmount: 10_000_000n, creator: a(stranger), lamports: 1n });
await sendAndConfirmTransaction(cx, new Transaction().add(SystemProgram.transfer({ fromPubkey: stranger.publicKey, toPubkey: new PublicKey(commission), lamports: 1_000_000 })), [stranger]);
const r = await C.recordSaleIx({ attestor: a(brand), payer: a(brand), campaign: cc.campaign, vault: cc.vault, orderHash: hash, orderAmount: 250_000_000n, creator: a(stranger), lamports: BigInt(await cx.getMinimumBalanceForRentExemption(C.COMMISSION_LEN)) });
try { await sendAndConfirmTransaction(cx, new Transaction().add(w(r.instruction)), [brand]); console.log("RESULT unkeyed: record_sale succeeded"); }
catch (e) { console.log("RESULT unkeyed: record_sale blocked by a stranger's 0.001 SOL transfer:", String((e as Error).message).slice(0, 90)); }

// Keyed hash: the stranger can only guess the unkeyed address, so the attestor's sale goes through.
const key = crypto.getRandomValues(new Uint8Array(32));
const keyed = await C.orderHash(cc.campaign, "4823", key);
const guess = await C.recordSaleIx({ attestor: a(brand), payer: a(brand), campaign: cc.campaign, vault: cc.vault, orderHash: await C.orderHash(cc.campaign, "4823"), orderAmount: 1n, creator: a(stranger), lamports: 1n });
await sendAndConfirmTransaction(cx, new Transaction().add(SystemProgram.transfer({ fromPubkey: stranger.publicKey, toPubkey: new PublicKey(guess.commission), lamports: 1_000_000 })), [stranger]);
const k2 = await C.recordSaleIx({ attestor: a(brand), payer: a(brand), campaign: cc.campaign, vault: cc.vault, orderHash: keyed, orderAmount: 250_000_000n, creator: a(stranger), lamports: BigInt(await cx.getMinimumBalanceForRentExemption(C.COMMISSION_LEN)) });
try { await sendAndConfirmTransaction(cx, new Transaction().add(w(k2.instruction)), [brand]); console.log("RESULT keyed: record_sale succeeded despite the stranger's transfer"); }
catch (e) { console.log("RESULT keyed: FAILED", String((e as Error).message).slice(0, 90)); }
const again = await C.recordSaleIx({ attestor: a(brand), payer: a(brand), campaign: cc.campaign, vault: cc.vault, orderHash: await C.orderHash(cc.campaign, "4823", key), orderAmount: 250_000_000n, creator: a(stranger), lamports: BigInt(await cx.getMinimumBalanceForRentExemption(C.COMMISSION_LEN)) });
try { await sendAndConfirmTransaction(cx, new Transaction().add(w(again.instruction)), [brand]); console.log("RESULT keyed duplicate: FAILED, recorded twice"); }
catch { console.log("RESULT keyed duplicate: rejected, same order cannot be recorded twice"); }
