// One real x402 call against the live endpoint, as an outside agent would make it.
// Usage: RPC_URL=<mainnet rpc> node scripts/paid-call.cjs [market] [--check]
//   --check  print balances and the 402 terms, send nothing
// CALLER pays 0.05 USDC into the vault with memo "commish:<ROUTER>", then retries with X-Payment.
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } = require("@solana/web3.js");

const SITE = process.env.SITE_URL || "https://getcommish.vercel.app";
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA = new PublicKey("ATokenGPvbdGVxr1b2hS1HQKdA6tkoxCSyoXJqRjRtR");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const role = (r) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path.join(__dirname, "../../agents/keys/mainnet", `${r}.keypair.json`), "utf8"))));
const ata = (owner) => PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), USDC.toBuffer()], ATA)[0];

(async () => {
  const market = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
  const check = process.argv.includes("--check");
  const cx = new Connection(process.env.RPC_URL, "confirmed");
  const caller = role("CALLER");
  const router = role("ROUTER").publicKey;
  const relayer = role("RELAYER").publicKey;
  const q = `ref=${router.toBase58()}${market ? `&market=${encodeURIComponent(market)}` : ""}`;

  const terms = await (await fetch(`${SITE}/api/agent/call?${q}`)).json();
  const t = terms.accepts[0];
  const vault = new PublicKey(t.payTo);
  const amount = BigInt(t.maxAmountRequired);
  // The USDC account with the most balance; it need not be the ATA (a Jupiter swap may create another).
  const usdcOf = async (k) => {
    const xs = (await cx.getParsedTokenAccountsByOwner(k, { mint: USDC })).value;
    xs.sort((a, b) => Number(BigInt(b.account.data.parsed.info.tokenAmount.amount) - BigInt(a.account.data.parsed.info.tokenAmount.amount)));
    return xs[0] ? { pubkey: xs[0].pubkey, amount: xs[0].account.data.parsed.info.tokenAmount.amount } : { pubkey: ata(k), amount: "0" };
  };
  const bal = async (k) => (await usdcOf(k)).amount;
  console.log(JSON.stringify({
    description: t.description, payTo: t.payTo, amount: amount.toString(), memo: t.extra.memo,
    callerUsdc: await bal(caller.publicKey), callerSol: (await cx.getBalance(caller.publicKey)) / 1e9,
    relayerSol: (await cx.getBalance(relayer)) / 1e9, routerUsdc: await bal(router),
  }, null, 2));
  if (check) return;

  const data = Buffer.alloc(9);
  data[0] = 3; // SPL Token Transfer
  data.writeBigUInt64LE(amount, 1);
  const tx = new Transaction().add(
    new TransactionInstruction({ programId: TOKEN, keys: [
      { pubkey: (await usdcOf(caller.publicKey)).pubkey, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: caller.publicKey, isSigner: true, isWritable: false },
    ], data }),
    new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from(t.extra.memo, "utf8") }),
  );
  const pay = await cx.sendTransaction(tx, [caller], { preflightCommitment: "confirmed" });
  await cx.confirmTransaction(pay, "confirmed");
  console.log("payment", pay);

  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${SITE}/api/agent/call?${q}`, { headers: { "X-Payment": pay } });
    const body = await r.json();
    console.log("HTTP", r.status, JSON.stringify(body, null, 2));
    if (r.status === 200) return;
    await new Promise((s) => setTimeout(s, 4000));
  }
})().catch((e) => { console.error(e); process.exit(1); });
