// End-to-end run of every Commish instruction against a live validator,
// using the same client (src/lib/commish/program.ts) the web app ships.
// Usage: RPC_URL=http://127.0.0.1:8899 node --import tsx scripts/lifecycle.mts <payer-keypair.json>
import { readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { address, type Address, type Instruction } from "@solana/kit";
import * as C from "../src/lib/commish/program.ts";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const cx = new Connection(RPC, "confirmed");
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.argv[2], "utf8"))));
const a = (k: Keypair | PublicKey): Address => address(("publicKey" in k ? k.publicKey : k).toBase58());
const web3 = (ix: Instruction) => new TransactionInstruction({
  programId: new PublicKey(ix.programAddress),
  keys: (ix.accounts ?? []).map((m) => ({ pubkey: new PublicKey(m.address), isWritable: (m.role & 1) === 1, isSigner: (m.role & 2) === 2 })),
  data: Buffer.from(ix.data ?? new Uint8Array()),
});
const U = (n: number) => BigInt(Math.round(n * 1e6));
const rows: string[][] = [];
let failed = 0;

async function send(label: string, ixs: (Instruction | TransactionInstruction)[], signers: Keypair[], expect?: number) {
  const tx = new Transaction().add(...ixs.map((i) => (i instanceof TransactionInstruction ? i : web3(i))));
  try {
    const sig = await sendAndConfirmTransaction(cx, tx, [payer, ...signers.filter((s) => !s.publicKey.equals(payer.publicKey))], { commitment: "confirmed" });
    const ok = expect === undefined;
    if (!ok) failed++;
    rows.push([label, ok ? "PASS" : "FAIL (should have been rejected)", sig.slice(0, 16) + "…"]);
    return sig;
  } catch (e) {
    const text = `${(e as Error).message} ${((e as { logs?: string[] }).logs ?? []).join(" ")}`;
    const m = text.match(/custom program error: 0x([0-9a-f]+)/i);
    const code = m ? parseInt(m[1], 16) : undefined;
    const ok = expect !== undefined && (expect === -1 || code === expect);
    if (!ok) failed++;
    const why = text.includes("already in use") ? "address already in use" : code !== undefined ? `${code} ${C.ERRORS[code] ?? ""}` : text.includes("already in use") ? "account already in use" : text.slice(0, 80);
    rows.push([label, ok ? `PASS (rejected: ${why})` : `FAIL (${why})`, "-"]);
  }
}
const bal = async (ata: Address) => BigInt((await cx.getTokenAccountBalance(new PublicKey(ata))).value.amount);
const check = (label: string, got: bigint, want: bigint) => { const ok = got === want; if (!ok) failed++; rows.push([label, ok ? `PASS (${Number(got) / 1e6})` : `FAIL got ${Number(got) / 1e6}, want ${Number(want) / 1e6}`, "-"]); };
const airdrop = async (k: Keypair) => { const s = await cx.requestAirdrop(k.publicKey, 2e9); await cx.confirmTransaction(s, "confirmed"); };

// ---- a token that stands in for USDC (the program takes any legacy SPL mint)
const mintKp = Keypair.generate(), mint = a(mintKp);
const brand = payer, attestor = Keypair.generate(), creator = Keypair.generate(), buyer = Keypair.generate(), stranger = Keypair.generate();
for (const k of [attestor, creator, buyer, stranger]) await airdrop(k);
const TOKEN = new PublicKey(C.TOKEN_PROGRAM);
const initMint = new TransactionInstruction({ programId: TOKEN, keys: [{ pubkey: mintKp.publicKey, isSigner: false, isWritable: true }], data: Buffer.concat([Buffer.from([20, 6]), brand.publicKey.toBuffer(), Buffer.from([0])]) });
const mintTo = (dest: Address, amt: bigint) => { const d = Buffer.alloc(9); d[0] = 7; d.writeBigUInt64LE(amt, 1); return new TransactionInstruction({ programId: TOKEN, keys: [{ pubkey: mintKp.publicKey, isSigner: false, isWritable: true }, { pubkey: new PublicKey(dest), isSigner: false, isWritable: true }, { pubkey: brand.publicKey, isSigner: true, isWritable: false }], data: d }); };
const mintRent = await cx.getMinimumBalanceForRentExemption(82);
const ataOf = (k: Keypair) => C.findAta(a(k), mint);
const [brandAta, creatorAta, buyerAta, strangerAta] = await Promise.all([ataOf(brand), ataOf(creator), ataOf(buyer), ataOf(stranger)]);
await send("setup: token mint and accounts", [
  SystemProgram.createAccount({ fromPubkey: brand.publicKey, newAccountPubkey: mintKp.publicKey, lamports: mintRent, space: 82, programId: TOKEN }), initMint,
  C.createAtaIx(a(brand), brandAta, a(brand), mint), C.createAtaIx(a(brand), creatorAta, a(creator), mint), C.createAtaIx(a(brand), buyerAta, a(buyer), mint), C.createAtaIx(a(brand), strangerAta, a(stranger), mint),
  mintTo(brandAta, U(1000)), mintTo(buyerAta, U(100)),
], [mintKp]);

// ---- campaign: 10%, 8-second refund window, a separate attestor key
const campRent = BigInt(await cx.getMinimumBalanceForRentExemption(C.CAMPAIGN_LEN));
const comRent = BigInt(await cx.getMinimumBalanceForRentExemption(C.COMMISSION_LEN));
const HOLD = 8n;
const bad = await C.createCampaignIxs({ brand: a(brand), id: C.randomCampaignId(), bps: 6000, holdSeconds: HOLD, attestor: a(attestor), mint, lamports: campRent });
await send("attack: rate above 50%", bad.instructions, [], 6007);
const cc = await C.createCampaignIxs({ brand: a(brand), id: C.randomCampaignId(), bps: 1000, holdSeconds: HOLD, attestor: a(attestor), mint, lamports: campRent });
const { campaign, vault } = cc;
await send("create_campaign (10%, 8 s window)", cc.instructions, []);
await send("fund vault with 100", [C.tokenTransferIx(brandAta, vault, a(brand), U(100))], []);

// ---- record sales
const sale = async (id: string, total: number, signer: Keypair, expect?: number) => {
  const h = await C.orderHash(campaign, id);
  const r = await C.recordSaleIx({ attestor: a(signer), payer: a(signer), campaign, vault, orderHash: h, orderAmount: U(total), creator: a(creator), lamports: comRent });
  await send(`record_sale ${id} (${total})${expect !== undefined ? " by " + (signer === attestor ? "attestor" : "stranger") : ""}`, [r.instruction], [signer], expect);
  return r.commission;
};
const comA = await sale("order-A", 250, attestor);
await sale("order-A", 250, attestor, -1);
await sale("order-X", 100, stranger, 6004);
await sale("order-Big", 2000, attestor, 6010);
const comB = await sale("order-B", 100, attestor);
const comC = await sale("order-C", 200, attestor);
const comD = await sale("order-D", 50, attestor);
const camp = C.decodeCampaign(campaign, new Uint8Array((await cx.getAccountInfo(new PublicKey(campaign)))!.data))!;
check("reserved = 25 + 10 + 20 + 5", camp.reserved, U(60));

// ---- brand withdrawals: only the unreserved 40 can leave
await send("attack: withdraw 41 of 40 unreserved", [C.withdrawIx({ brand: a(brand), campaign, vault, dest: brandAta, amount: U(41) })], [], 6010);
await send("attack: stranger withdraws", [C.withdrawIx({ brand: a(stranger), campaign, vault, dest: strangerAta, amount: U(1) })], [stranger], -1);
await send("withdraw 40 unreserved", [C.withdrawIx({ brand: a(brand), campaign, vault, dest: brandAta, amount: U(40) })], []);
check("vault after withdraw", await bal(vault), U(60));

// ---- refund inside the window
await send("attack: stranger cancels", [C.cancelIx({ attestor: a(stranger), campaign, commission: comB, rentPayer: a(attestor) })], [stranger], 6004);
await send("cancel order-B (refund in window)", [C.cancelIx({ attestor: a(attestor), campaign, commission: comB, rentPayer: a(attestor) })], [attestor]);

// ---- early payout: creator sells order-C (20) to buyer for 19.40
await send("attack: stranger sells creator's commission", [C.sellIx({ payee: a(stranger), buyer: a(buyer), campaign, commission: comC, buyerToken: buyerAta, payeeToken: strangerAta, price: U(19.4) })], [stranger, buyer], 6013);
await send("attack: sell above face value", [C.sellIx({ payee: a(creator), buyer: a(buyer), campaign, commission: comC, buyerToken: buyerAta, payeeToken: creatorAta, price: U(21) })], [creator, buyer], 6014);
await send("sell order-C for 19.40", [C.sellIx({ payee: a(creator), buyer: a(buyer), campaign, commission: comC, buyerToken: buyerAta, payeeToken: creatorAta, price: U(19.4) })], [creator, buyer]);
check("creator paid 19.40 today", await bal(creatorAta), U(19.4));

// ---- before the window closes
const rel = (com: Address, dest: Address) => C.releaseIx({ campaign, vault, commission: com, payeeToken: dest, rentPayer: a(attestor) });
await send("attack: release before window", [rel(comA, creatorAta)], [], 6011);

console.log("waiting for the refund window to close…");
await new Promise((r) => setTimeout(r, Number(HOLD + 3n) * 1000));

await send("attack: cancel after window", [C.cancelIx({ attestor: a(attestor), campaign, commission: comD, rentPayer: a(attestor) })], [attestor], 6012);
await send("attack: release order-A to brand's account", [rel(comA, brandAta)], [], 6013);
await send("release order-A (anyone, no signer)", [rel(comA, creatorAta)], []);
await send("attack: release order-A twice", [rel(comA, creatorAta)], [], -1);
await send("attack: release sold order-C to creator", [rel(comC, creatorAta)], [], 6013);
await send("release order-C to buyer", [rel(comC, buyerAta)], []);
await send("release order-D", [rel(comD, creatorAta)], []);
check("creator total = 19.40 + 25 + 5", await bal(creatorAta), U(49.4));
check("buyer = 100 - 19.40 + 20", await bal(buyerAta), U(100.6));
check("vault keeps the refunded 10, now unreserved", await bal(vault), U(10));
await send("withdraw the refunded 10", [C.withdrawIx({ brand: a(brand), campaign, vault, dest: brandAta, amount: U(10) })], []);
check("vault empty", await bal(vault), 0n);
const end = C.decodeCampaign(campaign, new Uint8Array((await cx.getAccountInfo(new PublicKey(campaign)))!.data))!;
check("campaign reserved = 0", end.reserved, 0n);
check("campaign paid = 25 + 20 + 5", end.paid, U(50));
for (const [n, c] of [["A", comA], ["B", comB], ["C", comC], ["D", comD]] as const) {
  const info = await cx.getAccountInfo(new PublicKey(c));
  const ok = info === null; if (!ok) failed++;
  rows.push([`commission ${n} account closed, rent refunded`, ok ? "PASS" : "FAIL", "-"]);
}

console.log(`\ncluster ${RPC}\nprogram ${C.PROGRAM_ID}\ncampaign ${campaign}\n`);
console.log("| Step | Result | Signature |\n| --- | --- | --- |");
for (const r of rows) console.log(`| ${r.join(" | ")} |`);
console.log(`\n${rows.length - failed} of ${rows.length} checks passed`);
process.exit(failed ? 1 : 0);
