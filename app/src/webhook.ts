/**
 * The bridge between a shop and the chain.
 *
 * A shop sends the same order webhook it already sends everyone else. We verify
 * the HMAC, look up which creator referred the order, and record the commission
 * on-chain. A refund webhook cancels it. Nothing here can move money on its
 * own: the attestor key may only reserve or release a brand's own budget, and
 * the program decides the amount from the campaign's rate.
 */
import express from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  getProgram,
  loadKeypair,
  orderHash,
  affiliatePda,
  commissionPda,
  vaultAta,
} from "./anchorClient";
import { attributionFor, recordPayout } from "./store";

const app = express();
app.use(express.raw({ type: "*/*" }));

const SECRET = process.env.SHOP_WEBHOOK_SECRET ?? "";
const connection = new Connection(
  process.env.RPC_URL ?? "http://127.0.0.1:8899",
  "confirmed",
);
const attestor = loadKeypair(process.env.ATTESTOR_KEY ?? "[]");
const program = getProgram(connection, attestor);
const CAMPAIGN = new PublicKey(process.env.CAMPAIGN ?? PublicKey.default);
const MINT = new PublicKey(process.env.USDC_MINT ?? PublicKey.default);

function verify(raw: Buffer, header: string | undefined): boolean {
  if (!SECRET) return true; // demo mode
  const mine = createHmac("sha256", SECRET).update(raw).digest();
  const theirs = Buffer.from(header ?? "", "base64");
  return mine.length === theirs.length && timingSafeEqual(mine, theirs);
}

app.post("/webhooks/order", async (req, res) => {
  if (!verify(req.body, req.header("x-shop-hmac-sha256")))
    return res.status(401).send("bad signature");

  const order = JSON.parse(req.body.toString());
  const creator = await attributionFor(order.id, order.referral_code);
  if (!creator) return res.json({ ok: true, skipped: "no attribution" });

  // Cents, so the on-chain amount matches USDC's 6 decimals.
  const amount = new BN(Math.round(Number(order.total_price) * 1_000_000));
  const hash = orderHash(order.shop, String(order.id));
  const wallet = new PublicKey(creator.wallet);

  const sig = await program.methods
    .recordSale(hash, amount)
    .accountsPartial({
      attestor: attestor.publicKey,
      campaign: CAMPAIGN,
      vault: vaultAta(CAMPAIGN, MINT),
      affiliate: affiliatePda(CAMPAIGN, wallet),
      commission: commissionPda(CAMPAIGN, hash),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  await recordPayout(order.id, creator.wallet, sig);
  res.json({ ok: true, signature: sig });
});

app.post("/webhooks/refund", async (req, res) => {
  if (!verify(req.body, req.header("x-shop-hmac-sha256")))
    return res.status(401).send("bad signature");

  const order = JSON.parse(req.body.toString());
  const creator = await attributionFor(order.id, order.referral_code);
  if (!creator) return res.json({ ok: true, skipped: "no attribution" });

  const hash = orderHash(order.shop, String(order.id));
  const sig = await program.methods
    .cancelCommission()
    .accountsPartial({
      attestor: attestor.publicKey,
      campaign: CAMPAIGN,
      commission: commissionPda(CAMPAIGN, hash),
      affiliate: affiliatePda(CAMPAIGN, new PublicKey(creator.wallet)),
    })
    .rpc();
  res.json({ ok: true, signature: sig });
});

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => console.log(`commish webhook on :${port}`));
}

export default app;
