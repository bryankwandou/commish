/**
 * Soak: one end-to-end run of the x402 holdback flow with 15 asserts.
 *
 *   CLUSTER=localnet HOLD=30 npx tsx agents/soak.ts
 *
 * Env: CLUSTER (localnet|devnet|mainnet, default localnet; mainnet also needs
 * CONFIRM_MAINNET=yes), HOLD (s, default 600), N (paid calls with ref,
 * default 4), FUND (vault funding, base units), USDC_MINT (devnet/mainnet
 * override), ROLES (roles.json; localnet generates throwaway keys instead).
 * Writes agents/out/soak-<date>.md. Exit 1 on any failed assert.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { address, getAddressEncoder, lamports, type Address, type Instruction, type KeyPairSigner, type Signature } from "@solana/kit";
import {
  CAMPAIGN_LEN,
  COMMISSION_LEN,
  PROGRAM_ID,
  SYSTEM_PROGRAM,
  TOKEN_PROGRAM,
  TREASURY,
  USDC_MINT,
  commissionFor,
  createAtaIx,
  createCampaignIxs,
  decodeCampaign,
  decodeCommission,
  decodeTokenAccount,
  explainError,
  findAta,
  netOfFee,
  randomCampaignId,
  recordSaleIx,
  releaseIx,
  sellIx,
  tokenTransferIx,
  withdrawIx,
  type Campaign,
} from "../web/src/lib/commish/program";
import {
  AGENTS_DIR,
  ROLES,
  RpcPool,
  TxError,
  accountBytes,
  cluster,
  errText,
  explorer,
  loadRole,
  log,
  memoIx,
  newKeypairFile,
  rentFor,
  sendTx,
  sleep,
  type Role,
} from "./lib";
import { cancelWithProof, recordPayment, x402OrderHash, type RelayerConfig } from "./relayer";
import { listCommissions, releaseDue } from "./keeper";

const C = cluster();
if (C === "mainnet" && process.env.CONFIRM_MAINNET !== "yes") {
  console.error(JSON.stringify({ event: "refused", reason: "mainnet needs CONFIRM_MAINNET=yes" }));
  process.exit(1);
}

const HOLD = BigInt(process.env.HOLD ?? "600");
const N = Number(process.env.N ?? "4");
const PRICE_A = 50_000n;
const PRICE_B = 80_000n;
const BPS = 1_000;
const FUND = BigInt(process.env.FUND ?? "1000000");
const SOAK = "commish:soak";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

type TxRow = { step: string; sig: string; ok: boolean; note?: string };
type AssertRow = { n: number; name: string; ok: boolean; detail: string };
const txs: TxRow[] = [];
const asserts: AssertRow[] = [];

function check(name: string, ok: boolean, detail: string) {
  const row = { n: asserts.length + 1, name, ok, detail };
  asserts.push(row);
  log(ok ? "assert_pass" : "assert_fail", row);
}

async function step(pool: RpcPool, name: string, signers: KeyPairSigner[], ixs: Instruction[]): Promise<string> {
  const sig = await sendTx(pool, signers, ixs, name);
  txs.push({ step: name, sig, ok: true });
  log("tx", { step: name, sig });
  return sig;
}

/** Expect the tx to fail; returns the program error code (or -1 if it failed without one, null if it succeeded). */
async function expectFail(pool: RpcPool, name: string, signers: KeyPairSigner[], ixs: Instruction[]): Promise<number | null> {
  try {
    const sig = await sendTx(pool, signers, ixs, name);
    txs.push({ step: name, sig, ok: true, note: "UNEXPECTED SUCCESS" });
    return null;
  } catch (e) {
    const code = e instanceof TxError ? e.code : undefined;
    txs.push({ step: name, sig: e instanceof TxError && e.signature ? e.signature : "-", ok: false, note: `expected failure, code ${code ?? "?"} ${code ? explainError(code) ?? "" : ""}`.trim() });
    log("expected_fail", { step: name, code, error: errText(e).slice(0, 200) });
    return code ?? -1;
  }
}

async function tokenBal(pool: RpcPool, a: Address): Promise<bigint> {
  const b = await accountBytes(pool, a);
  return b ? (decodeTokenAccount(b)?.amount ?? 0n) : 0n;
}

async function campaignState(pool: RpcPool, a: Address): Promise<Campaign | null> {
  const b = await accountBytes(pool, a);
  return b ? decodeCampaign(a, b) : null;
}

async function chainTime(pool: RpcPool): Promise<bigint> {
  const slot = await pool.call((r) => r.getSlot({ commitment: "confirmed" }).send(), "slot");
  const t = await pool.call((r) => r.getBlockTime(slot).send(), "blockTime");
  return BigInt(t ?? Math.floor(Date.now() / 1000));
}

// ------------------------------------------------------------- localnet setup

async function localKeys(pool: RpcPool): Promise<Record<Role, KeyPairSigner>> {
  const out = {} as Record<Role, KeyPairSigner>;
  for (const r of ROLES) {
    out[r] = await newKeypairFile(`keys/localnet/${r}.keypair.json`);
    const sig = await pool.call((rpc) => (rpc as any).requestAirdrop(out[r].address, lamports(5_000_000_000n), { commitment: "confirmed" }).send(), "airdrop");
    for (let i = 0; i < 60; i++) {
      const { value } = await pool.call((rpc) => rpc.getSignatureStatuses([sig as Signature]).send(), "status");
      if (value[0]?.confirmationStatus === "confirmed" || value[0]?.confirmationStatus === "finalized") break;
      await sleep(500);
    }
  }
  return out;
}

async function createTestMint(pool: RpcPool, payer: KeyPairSigner): Promise<Address> {
  const mint = await newKeypairFile(`keys/localnet/MINT.keypair.json`);
  const rent = await rentFor(pool, 82);
  const ca = new Uint8Array(52);
  const v = new DataView(ca.buffer);
  v.setUint32(0, 0, true);
  v.setBigUint64(4, rent, true);
  v.setBigUint64(12, 82n, true);
  ca.set(require58(TOKEN_PROGRAM), 20);
  const init = new Uint8Array(35);
  init[0] = 20; // InitializeMint2
  init[1] = 6;
  init.set(require58(payer.address), 2);
  init[34] = 0; // no freeze authority
  await step(pool, "create_test_mint", [payer, mint], [
    { programAddress: SYSTEM_PROGRAM, accounts: [{ address: payer.address, role: 3 }, { address: mint.address, role: 3 }], data: ca },
    { programAddress: TOKEN_PROGRAM, accounts: [{ address: mint.address, role: 1 }], data: init },
  ]);
  return mint.address;
}

function mintToIx(mint: Address, dest: Address, authority: Address, amount: bigint): Instruction {
  const d = new Uint8Array(9);
  d[0] = 7;
  new DataView(d.buffer).setBigUint64(1, amount, true);
  return { programAddress: TOKEN_PROGRAM, accounts: [{ address: mint, role: 1 }, { address: dest, role: 1 }, { address: authority, role: 2 }], data: d };
}

const require58 = (a: Address) => getAddressEncoder().encode(a) as Uint8Array;

// ------------------------------------------------------------------ main

async function main() {
  const pool = new RpcPool();
  log("soak_start", { cluster: C, hold: HOLD, n: N, rpc: pool.urls[0] });

  const prog = await accountBytes(pool, PROGRAM_ID);
  if (!prog) throw new Error(`program ${PROGRAM_ID} not found on ${C}. Localnet: start solana-test-validator with --bpf-program ${PROGRAM_ID} program/target/deploy/commish.so`);

  let k: Record<Role, KeyPairSigner>;
  let mint: Address;
  if (C === "localnet") {
    k = await localKeys(pool);
    mint = await createTestMint(pool, k.TOOL_TREASURY);
  } else {
    k = {} as Record<Role, KeyPairSigner>;
    for (const r of ROLES) k[r] = await loadRole(r);
    mint = address(process.env.USDC_MINT ?? (C === "mainnet" ? USDC_MINT : "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"));
  }
  const founders = new Set<string>(Object.values(k).map((s) => s.address));

  const ata = {} as Record<Role | "TREASURY", Address>;
  for (const r of ROLES) ata[r] = await findAta(k[r].address, mint);
  ata.TREASURY = await findAta(TREASURY, mint);

  // token accounts for everyone who holds USDC, plus the fee treasury
  await step(pool, "create_token_accounts", [k.KEEPER], [
    ...(["TOOL_TREASURY", "ROUTER", "CALLER", "BUYER_DESK"] as Role[]).map((r) => createAtaIx(k.KEEPER.address, ata[r], k[r].address, mint)),
    createAtaIx(k.KEEPER.address, ata.TREASURY, TREASURY, mint),
  ]);
  if (C === "localnet") {
    await step(pool, "mint_test_usdc", [k.TOOL_TREASURY], [
      mintToIx(mint, ata.TOOL_TREASURY, k.TOOL_TREASURY.address, 10_000_000n),
      mintToIx(mint, ata.CALLER, k.TOOL_TREASURY.address, 10_000_000n),
      mintToIx(mint, ata.BUYER_DESK, k.TOOL_TREASURY.address, 10_000_000n),
    ]);
  }

  // 1. campaign
  const id = randomCampaignId();
  const { campaign, vault, instructions } = await createCampaignIxs({
    brand: k.TOOL_TREASURY.address,
    id,
    bps: BPS,
    holdSeconds: HOLD,
    attestor: k.RELAYER.address,
    mint,
    lamports: await rentFor(pool, CAMPAIGN_LEN),
  });
  await step(pool, "create_campaign", [k.TOOL_TREASURY], [...instructions, memoIx(SOAK)]);
  let camp = await campaignState(pool, campaign);
  check("campaign_created", !!camp && camp.bps === BPS && camp.holdSeconds === HOLD && camp.attestor === k.RELAYER.address && camp.vault === vault, `campaign ${campaign}, hold ${HOLD}s, bps ${BPS}`);

  // 2. fund
  await step(pool, "fund_vault", [k.TOOL_TREASURY], [tokenTransferIx(ata.TOOL_TREASURY, vault, k.TOOL_TREASURY.address, FUND), memoIx(SOAK)]);
  const funded = await tokenBal(pool, vault);
  check("vault_funded", funded === FUND, `vault balance ${funded} (expected ${FUND})`);

  const cfg: RelayerConfig = {
    pool,
    relayer: k.RELAYER,
    campaign,
    mint,
    minPrice: PRICE_A,
    ledgerPath: `${AGENTS_DIR}/out/soak-ledger-${stamp}.jsonl`,
    founders,
  };

  const pay = async (label: string, amount: bigint, memo: string | null) =>
    step(pool, label, [k.CALLER], [tokenTransferIx(ata.CALLER, vault, k.CALLER.address, amount), ...(memo ? [memoIx(memo)] : [])]);

  // 3-5. paid calls with ref at two price points
  const paid: { sig: string; price: bigint; commission?: Address }[] = [];
  for (let i = 0; i < N; i++) {
    const price = i % 2 === 0 ? PRICE_A : PRICE_B;
    const sig = await pay(`paid_call_${i + 1}_${price}`, price, `commish:${k.ROUTER.address}`);
    const r = await recordPayment(cfg, sig);
    if (r.ok && r.recorded) txs.push({ step: `record_sale_${i + 1}`, sig: r.tx, ok: true, note: `label ${r.label}` });
    paid.push({ sig, price, commission: r.ok && r.recorded ? r.commission : undefined });
  }
  const commAmt = async (a?: Address) => {
    if (!a) return -1n;
    const b = await accountBytes(pool, a);
    const c = b ? decodeCommission(a, b) : null;
    return c && c.creator === k.ROUTER.address ? c.amount : -1n;
  };
  const okFor = async (price: bigint) => {
    const rows = paid.filter((p) => p.price === price);
    for (const p of rows) if ((await commAmt(p.commission)) !== commissionFor(price, BPS)) return false;
    return rows.length > 0;
  };
  check("paid_calls_price_A_recorded", await okFor(PRICE_A), `${paid.filter((p) => p.price === PRICE_A).length} calls at ${PRICE_A}, commission ${commissionFor(PRICE_A, BPS)} each`);
  check("paid_calls_price_B_recorded", await okFor(PRICE_B), `${paid.filter((p) => p.price === PRICE_B).length} calls at ${PRICE_B}, commission ${commissionFor(PRICE_B, BPS)} each`);
  const expectedReserved = paid.reduce((s, p) => s + commissionFor(p.price, BPS), 0n);
  camp = await campaignState(pool, campaign);
  check("reserved_equals_sum", camp?.reserved === expectedReserved, `reserved ${camp?.reserved} expected ${expectedReserved}`);

  // 6. no ref
  const noRefSig = await pay("call_no_ref", PRICE_A, null);
  const noRef = await recordPayment(cfg, noRefSig);
  camp = await campaignState(pool, campaign);
  check("no_ref_no_commission", noRef.ok && !noRef.recorded && camp?.reserved === expectedReserved, `result ${noRef.ok ? (noRef.recorded ? "recorded" : noRef.reason) : noRef.reason}`);

  // 7. invalid ref
  const badSig = await pay("call_invalid_ref", PRICE_A, "commish:not-a-pubkey");
  const bad = await recordPayment(cfg, badSig);
  check("invalid_ref_rejected", !bad.ok && bad.status === 400 && bad.reason === "invalid_ref", `status ${bad.ok ? 200 : bad.status} ${bad.ok ? "" : bad.reason}`);

  // 8. double pay same signature
  const again = await recordPayment(cfg, paid[0].sig);
  const { instruction: dupIx } = await recordSaleIx({
    attestor: k.RELAYER.address,
    payer: k.RELAYER.address,
    campaign,
    vault,
    orderHash: x402OrderHash(campaign, paid[0].sig),
    orderAmount: paid[0].price,
    creator: k.ROUTER.address,
    lamports: await rentFor(pool, COMMISSION_LEN),
  });
  const dupCode = await expectFail(pool, "double_record_direct", [k.RELAYER], [dupIx]);
  check("double_pay_refused", !again.ok && again.status === 409 && dupCode !== null, `relayer ${again.ok ? "ACCEPTED" : again.reason}; direct record_sale ${dupCode === null ? "SUCCEEDED" : "failed"}`);

  // 9. withdraw reserved
  const bal = await tokenBal(pool, vault);
  const wCode = await expectFail(pool, "withdraw_reserved", [k.TOOL_TREASURY], [withdrawIx({ brand: k.TOOL_TREASURY.address, campaign, vault, dest: ata.TOOL_TREASURY, amount: bal }), memoIx(SOAK)]);
  check("withdraw_reserved_fails", wCode === 6010, `withdraw ${bal} -> code ${wCode}`);

  // 10. release before window
  const first = paid[0].commission!;
  const rCode = await expectFail(pool, "release_early", [k.KEEPER], [
    releaseIx({ campaign, vault, commission: first, payeeToken: ata.ROUTER, rentPayer: k.RELAYER.address, treasuryToken: ata.TREASURY }),
  ]);
  check("release_before_window_fails", HOLD > 0n ? rCode === 6011 : rCode === null, `code ${rCode}`);

  // 11. sell to BUYER_DESK
  const sold = paid[1]?.commission;
  const soldAmt = await commAmt(sold);
  const salePrice = soldAmt - soldAmt / 10n;
  const routerBefore = await tokenBal(pool, ata.ROUTER);
  let sellOk = false;
  if (sold) {
    try {
      await step(pool, "sell_to_buyer_desk", [k.BUYER_DESK, k.ROUTER], [
        sellIx({ payee: k.ROUTER.address, buyer: k.BUYER_DESK.address, campaign, commission: sold, buyerToken: ata.BUYER_DESK, payeeToken: ata.ROUTER, price: salePrice }),
        memoIx(SOAK),
      ]);
      const b = await accountBytes(pool, sold);
      const c = b ? decodeCommission(sold, b) : null;
      sellOk = !!c && c.payee === k.BUYER_DESK.address && c.sold && (await tokenBal(pool, ata.ROUTER)) - routerBefore === salePrice;
    } catch (e) {
      log("step_error", { step: "sell", error: errText(e).slice(0, 300) });
    }
  }
  check("sell_to_buyer_desk", sellOk, `sold ${sold} for ${salePrice} (commission ${soldAmt})`);

  // 12. cancel with refund proof, then replay of the same payment refused
  const cancelP = paid[2];
  let cancelOk = false;
  let replayDetail = "";
  if (cancelP?.commission) {
    try {
      const reservedBefore = (await campaignState(pool, campaign))!.reserved;
      const refundSig = await step(pool, "refund_to_caller", [k.TOOL_TREASURY], [
        withdrawIx({ brand: k.TOOL_TREASURY.address, campaign, vault, dest: ata.CALLER, amount: cancelP.price }),
        memoIx(`commish:refund:${cancelP.sig}`),
      ]);
      const cr = await cancelWithProof(cfg, cancelP.sig, refundSig);
      if (cr.tx) txs.push({ step: "cancel", sig: cr.tx, ok: true });
      const gone = !(await accountBytes(pool, cancelP.commission));
      const reservedAfter = (await campaignState(pool, campaign))!.reserved;
      const replay = await recordPayment({ ...cfg, ledgerPath: `${AGENTS_DIR}/out/soak-ledger-${stamp}-empty.jsonl` }, cancelP.sig);
      replayDetail = `replay with empty ledger: ${replay.ok ? "ACCEPTED" : replay.reason}`;
      cancelOk = cr.ok && gone && reservedBefore - reservedAfter === commissionFor(cancelP.price, BPS) && !replay.ok && replay.reason === "commission_pda_has_history";
    } catch (e) {
      log("step_error", { step: "cancel", error: errText(e).slice(0, 300) });
    }
  }
  check("cancel_with_refund", cancelOk, `commission ${cancelP?.commission} closed by relayer after refund proof; ${replayDetail}`);

  // wait for the window
  const open = await listCommissions(pool, campaign);
  const maxRelease = open.reduce((m, c) => (c.releaseAt > m ? c.releaseAt : m), 0n);
  for (;;) {
    const t = await chainTime(pool);
    if (t >= maxRelease) break;
    log("waiting_window", { secondsLeft: maxRelease - t });
    await sleep(Number(maxRelease - t > 10n ? 10_000n : (maxRelease - t + 1n) * 1000n));
  }

  // 13-14. keeper release
  const buyerBefore = await tokenBal(pool, ata.BUYER_DESK);
  const routerBeforeRel = await tokenBal(pool, ata.ROUTER);
  const feeBefore = await tokenBal(pool, ata.TREASURY);
  for (let i = 0; i < 10; i++) {
    const sigs = await releaseDue(pool, k.KEEPER, campaign, await chainTime(pool));
    for (const s of sigs) txs.push({ step: "keeper_release", sig: s, ok: true });
    if ((await listCommissions(pool, campaign)).length === 0) break;
    await sleep(3000);
  }
  const left = await listCommissions(pool, campaign);
  camp = await campaignState(pool, campaign);
  check("keeper_released_all", left.length === 0 && camp?.reserved === 0n, `open after keeper: ${left.length}, reserved ${camp?.reserved}, paid ${camp?.paid}`);

  const routerAmts = open.filter((c) => c.payee === k.ROUTER.address).map((c) => c.amount);
  const buyerAmts = open.filter((c) => c.payee === k.BUYER_DESK.address).map((c) => c.amount);
  const expRouter = routerAmts.reduce((s, a) => s + netOfFee(a), 0n);
  const expBuyer = buyerAmts.reduce((s, a) => s + netOfFee(a), 0n);
  const expFee = open.reduce((s, c) => s + (c.amount - netOfFee(c.amount)), 0n);
  const dRouter = (await tokenBal(pool, ata.ROUTER)) - routerBeforeRel;
  const dBuyer = (await tokenBal(pool, ata.BUYER_DESK)) - buyerBefore;
  const dFee = (await tokenBal(pool, ata.TREASURY)) - feeBefore;
  check("payouts_correct", dRouter === expRouter && dBuyer === expBuyer && dFee === expFee && buyerAmts.length === 1, `router +${dRouter}/${expRouter}, buyer desk +${dBuyer}/${expBuyer}, fee +${dFee}/${expFee}`);

  // 15. withdraw unreserved
  const rest = await tokenBal(pool, vault);
  let wOk = false;
  try {
    await step(pool, "withdraw_unreserved", [k.TOOL_TREASURY], [withdrawIx({ brand: k.TOOL_TREASURY.address, campaign, vault, dest: ata.TOOL_TREASURY, amount: rest }), memoIx(SOAK)]);
    wOk = (await tokenBal(pool, vault)) === 0n;
  } catch (e) {
    log("step_error", { step: "withdraw_unreserved", error: errText(e).slice(0, 300) });
  }
  check("withdraw_unreserved", wOk, `withdrew ${rest}, vault now ${await tokenBal(pool, vault)}`);

  return { campaign, vault, mint };
}

function report(meta: { campaign?: string; vault?: string; mint?: string; fatal?: string }) {
  const passed = asserts.filter((a) => a.ok).length;
  const lines = [
    `# SOAK run ${stamp}`,
    ``,
    `Label: **SOAK** (every tx below was signed by founder-run role keys). FOREIGN payments: 0.`,
    ``,
    `- Cluster: ${C}`,
    `- Program: ${PROGRAM_ID}`,
    `- Campaign: ${meta.campaign ?? "-"}`,
    `- Vault: ${meta.vault ?? "-"}`,
    `- Mint: ${meta.mint ?? "-"}${C === "localnet" ? " (test mint, not USDC)" : ""}`,
    `- Hold: ${HOLD}s, paid calls with ref: ${N}, prices ${PRICE_A} / ${PRICE_B}`,
    `- Result: ${passed}/${asserts.length} asserts passed${asserts.length !== 15 ? ` (expected 15)` : ""}`,
    ...(meta.fatal ? [`- FATAL: ${meta.fatal}`] : []),
    ``,
    `## Asserts`,
    ``,
    `| # | Assert | Result | Detail |`,
    `|---|---|---|---|`,
    ...asserts.map((a) => `| ${a.n} | ${a.name} | ${a.ok ? "PASS" : "FAIL"} | ${a.detail.replace(/\|/g, "/")} |`),
    ``,
    `## Transactions`,
    ``,
    `| Step | Signature | Outcome |`,
    `|---|---|---|`,
    ...txs.map((t) => `| ${t.step} | ${t.sig === "-" ? "-" : `[${t.sig.slice(0, 16)}...](${explorer(t.sig, C)})`} | ${t.ok ? "SOAK ok" : "SOAK"}${t.note ? ` - ${t.note}` : ""} |`),
    ``,
  ];
  mkdirSync(`${AGENTS_DIR}/out`, { recursive: true });
  const path = `${AGENTS_DIR}/out/soak-${stamp}.md`;
  writeFileSync(path, lines.join("\n"));
  log("soak_report", { path, passed, total: asserts.length });
}

main()
  .then((meta) => {
    report(meta);
    process.exitCode = asserts.length === 15 && asserts.every((a) => a.ok) ? 0 : 1;
  })
  .catch((e) => {
    log("fatal", { error: errText(e).slice(0, 800) });
    report({ fatal: errText(e).slice(0, 300) });
    process.exitCode = 1;
  });
