import { address } from "@solana/kit";
import { releaseIx, findAta, TREASURY } from "../web/src/lib/commish/program";
import { RpcPool, loadKeypairFile, sendTx, log } from "./lib";
const USDC = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const pool = new RpcPool();
const payer = await loadKeypairFile(process.env.HOME_KEY!);
const c = address("sJta1eH4U3ckqyM9rT771T9xxDuGpKZumweB8Jpy4XH");
const j: any = await (await fetch(`https://getcommish.vercel.app/api/campaign/${c}`)).json();
for (const m of j.commissions) {
  const sig = await sendTx(pool, [payer], [releaseIx({ campaign: c, vault: address(j.campaign.vault), commission: address(m.address), payeeToken: await findAta(address(m.payee), USDC), rentPayer: address(m.rentPayer), treasuryToken: await findAta(TREASURY, USDC) })], "release");
  log("released", { commission: m.address, sig });
}
