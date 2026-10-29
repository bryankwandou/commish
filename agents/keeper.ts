/**
 * Keeper: releases every commission whose refund window has closed. KEEPER is
 * the only signer (fee payer); release itself is permissionless.
 *
 *   npx tsx agents/keeper.ts          # loop every 30 s
 *   npx tsx agents/keeper.ts once     # one pass
 *
 * Env: CLUSTER, RPC_URL, RPC_URL_2, ROLES, CAMPAIGN (optional filter), INTERVAL_MS.
 */
import type { Address, Base58EncodedBytes, KeyPairSigner } from "@solana/kit";
import {
  COMMISSION_LEN,
  PROGRAM_ID,
  TREASURY,
  createAtaIx,
  decodeCampaign,
  decodeCommission,
  findAta,
  releaseIx,
  type Commission,
} from "../web/src/lib/commish/program";
import { RpcPool, accountBytes, cluster, errText, loadRole, log, sendTx, sleep } from "./lib";

/** Open commissions (184 bytes, tag 2), optionally for one campaign. */
export async function listCommissions(pool: RpcPool, campaign?: Address): Promise<Commission[]> {
  const filters: any[] = [{ dataSize: BigInt(COMMISSION_LEN) }, { memcmp: { offset: 0n, bytes: "3" as Base58EncodedBytes, encoding: "base58" } }];
  if (campaign) filters.push({ memcmp: { offset: 8n, bytes: campaign as unknown as Base58EncodedBytes, encoding: "base58" } });
  const res: any[] = await pool.call((r) => r.getProgramAccounts(PROGRAM_ID, { encoding: "base64", commitment: "confirmed", filters }).send() as Promise<any>, "gpa");
  const out: Commission[] = [];
  for (const a of res) {
    const c = decodeCommission(a.pubkey, Uint8Array.from(Buffer.from(a.account.data[0], "base64")));
    if (c) out.push(c);
  }
  return out;
}

/** One pass: release all due commissions. Returns tx signatures of successful releases. */
export async function releaseDue(pool: RpcPool, keeper: KeyPairSigner, campaign?: Address, now = BigInt(Math.floor(Date.now() / 1000))): Promise<string[]> {
  const sent: string[] = [];
  let all: Commission[];
  try {
    all = await listCommissions(pool, campaign);
  } catch (e) {
    log("keeper_scan_error", { error: errText(e).slice(0, 300) });
    return sent;
  }
  const due = all.filter((c) => c.releaseAt <= now);
  log("keeper_scan", { open: all.length, due: due.length });
  for (const c of due) {
    try {
      // skip if closed meanwhile
      const still = await accountBytes(pool, c.address);
      if (!still || !decodeCommission(c.address, still)) {
        log("keeper_skip_closed", { commission: c.address });
        continue;
      }
      const cb = await accountBytes(pool, c.campaign);
      const camp = cb ? decodeCampaign(c.campaign, cb) : null;
      if (!camp) {
        log("keeper_skip", { commission: c.address, reason: "campaign_missing" });
        continue;
      }
      const payeeToken = await findAta(c.payee, camp.mint);
      const treasuryToken = await findAta(TREASURY, camp.mint);
      const ixs = [];
      if (!(await accountBytes(pool, payeeToken))) ixs.push(createAtaIx(keeper.address, payeeToken, c.payee, camp.mint));
      if (!(await accountBytes(pool, treasuryToken))) ixs.push(createAtaIx(keeper.address, treasuryToken, TREASURY, camp.mint));
      ixs.push(releaseIx({ campaign: c.campaign, vault: camp.vault, commission: c.address, payeeToken, rentPayer: c.rentPayer, treasuryToken }));
      log("keeper_attempt", { commission: c.address, payee: c.payee, amount: c.amount, releaseAt: c.releaseAt });
      const sig = await sendTx(pool, [keeper], ixs, "release");
      log("keeper_released", { commission: c.address, tx: sig });
      sent.push(sig);
    } catch (e) {
      log("keeper_release_failed", { commission: c.address, error: errText(e).slice(0, 300) });
    }
  }
  return sent;
}

async function main() {
  if (cluster() === "mainnet" && process.env.CONFIRM_MAINNET !== "yes") throw new Error("mainnet refused: set CONFIRM_MAINNET=yes");
  const pool = new RpcPool();
  const keeper = await loadRole("KEEPER");
  const campaign = process.env.CAMPAIGN as Address | undefined;
  const once = process.argv[2] === "once";
  const interval = Number(process.env.INTERVAL_MS ?? 30_000);
  log("keeper_start", { keeper: keeper.address, campaign: campaign ?? "all", once });
  do {
    await releaseDue(pool, keeper, campaign);
    if (!once) await sleep(interval);
  } while (!once);
}

if (process.argv[1] && /keeper\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    log("fatal", { error: errText(e) });
    process.exitCode = 1;
  });
}
