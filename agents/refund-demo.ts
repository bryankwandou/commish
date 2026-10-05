// Return demo-recording funds: withdraw unreserved USDC from the 42az demo
// campaigns, then send all of 42az's USDC back to Zd2 (the wallet that funded it).
import { address } from "@solana/kit";
import { withdrawIx, findAta, tokenTransferIx } from "../web/src/lib/commish/program";
import { RpcPool, loadKeypairFile, sendTx, memoIx, log } from "./lib";
const USDC = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const ZD2 = address("Zd2Cn5FZbSHCQJzjqhCjXgSphjh2jrEP8WRehUYff5K");
const pool = new RpcPool();
const brand = await loadKeypairFile(process.env.HOME_KEY!);
const camps: any[] = await (await fetch(`https://getcommish.vercel.app/api/campaigns?brand=${brand.address}`)).json();
const dest = await findAta(brand.address, USDC);
for (const c of camps) {
  const free = BigInt(c.vaultBalance) - BigInt(c.reserved);
  if (free <= 0n) continue;
  const sig = await sendTx(pool, [brand], [withdrawIx({ brand: brand.address, campaign: address(c.address), vault: address(c.vault), dest, amount: free }), memoIx("commish:soak refund")], "withdraw");
  log("withdraw", { campaign: c.address, amount: free, sig });
}
const { value } = await pool.call((r) => r.getTokenAccountBalance(dest).send());
const amt = BigInt(value.amount);
const sig = await sendTx(pool, [brand], [tokenTransferIx(dest, await findAta(ZD2, USDC), brand.address, amt), memoIx("commish:soak refund")], "return");
log("returned_to_zd2", { amount: amt, sig });
