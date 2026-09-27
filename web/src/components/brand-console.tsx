"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ExternalLink, Plus, RefreshCw } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { address, isAddress, type Address } from "@solana/kit";
import { useI18n } from "./providers";
import { AppShell, Button, Card, Field, NeedWallet, Stat, TxStatus, inputCls, useCountdown, useJson, useTx } from "./app-kit";
import { CopyButton } from "./ui";
import { useSend } from "@/lib/tx";
import { fmt } from "@/i18n";
import { SITE_URL, explorerAddress, parseUsdc, short, usdc } from "@/lib/config";
import {
  CAMPAIGN_LEN,
  COMMISSION_LEN,
  USDC_MINT,
  cancelIx,
  commissionFor,
  createAtaIx,
  createCampaignIxs,
  findAta,
  attestorKey,
  orderHash,
  randomCampaignId,
  recordSaleIx,
  releaseIx,
  TREASURY,
  tokenTransferIx,
  withdrawIx,
} from "@/lib/commish/program";

export type CampaignJson = {
  address: string;
  brand: string;
  attestor: string;
  mint: string;
  vault: string;
  id: string;
  holdSeconds: string;
  reserved: string;
  paid: string;
  bps: number;
  vaultBalance: string;
};

export type CommissionJson = {
  address: string;
  sold: boolean;
  campaign: string;
  creator: string;
  payee: string;
  rentPayer: string;
  amount: string;
  releaseAt: string;
};

export function BrandConsole() {
  const { t } = useI18n();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const me = publicKey?.toBase58() ?? null;
  const campaigns = useJson<CampaignJson[]>(me && `/api/campaigns?brand=${me}`);
  const list = campaigns.data === undefined ? null : (campaigns.data ?? []);
  const [bal, setBal] = useState<{ owner: string; amount: bigint } | null>(null);
  const [balTick, setBalTick] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!me) return;
    let live = true;
    const set = (amount: bigint) => live && setBal({ owner: me, amount });
    findAta(address(me), USDC_MINT)
      .then((ata) => connection.getTokenAccountBalance(new PublicKey(ata)))
      .then((b) => set(BigInt(b.value.amount)))
      .catch(() => set(0n));
    return () => {
      live = false;
    };
  }, [me, connection, balTick]);
  const walletUsdc = bal && bal.owner === me ? bal.amount : null;

  const { reload: reloadCampaigns } = campaigns;
  const load = useCallback(() => {
    reloadCampaigns();
    setBalTick((n) => n + 1);
  }, [reloadCampaigns]);

  return (
    <AppShell
      title={t.app.brand.title}
      sub={t.app.brand.sub}
      actions={
        publicKey && (
          <div className="flex items-center gap-2">
            {walletUsdc !== null && <span className="tabular rounded-lg border border-line px-3 py-2 text-sm text-muted">{usdc(walletUsdc)} USDC</span>}
            <Button tone="ghost" onClick={load}>
              <RefreshCw size={14} /> {t.app.refresh}
            </Button>
            <Button onClick={() => setCreating(!creating)}>
              <Plus size={15} /> {t.app.brand.create}
            </Button>
          </div>
        )
      }
    >
      <NeedWallet>
        <AnimatePresence>{creating && <CreateForm onDone={() => { setCreating(false); load(); }} />}</AnimatePresence>
        <h2 className="mb-4 text-sm font-medium text-muted">{t.app.brand.mine}</h2>
        {list === null ? (
          <p className="text-sm text-muted">{t.app.loading}</p>
        ) : list.length === 0 ? (
          <Card className="py-12 text-center text-sm text-muted">{t.app.brand.none}</Card>
        ) : (
          <div className="space-y-4">
            {list.map((c) => (
              <CampaignCard key={c.address} c={c} reload={load} />
            ))}
          </div>
        )}
      </NeedWallet>
    </AppShell>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const b = t.app.brand;
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const send = useSend();
  const tx = useTx();
  const [rate, setRate] = useState("10");
  const [days, setDays] = useState("14");
  const [mode, setMode] = useState<"me" | "key">("me");
  const [attestor, setAttestor] = useState("");
  const [budget, setBudget] = useState("");

  const bps = Math.round(Number(rate) * 100);
  const hold = Number(days);
  const budgetUnits = budget ? parseUsdc(budget) : 0n;
  const valid = bps >= 1 && bps <= 5000 && Number.isInteger(hold) && hold >= 0 && hold <= 90 && (mode === "me" || isAddress(attestor)) && budgetUnits !== null;

  const submit = () =>
    tx.run(async () => {
      const brand = address(publicKey!.toBase58());
      const lamports = BigInt(await connection.getMinimumBalanceForRentExemption(CAMPAIGN_LEN));
      const { vault, instructions } = await createCampaignIxs({
        brand,
        id: randomCampaignId(),
        bps,
        holdSeconds: BigInt(hold * 86400),
        attestor: mode === "me" ? brand : (attestor as Address),
        mint: USDC_MINT,
        lamports,
      });
      const ixs = [...instructions];
      if (budgetUnits && budgetUnits > 0n) ixs.push(tokenTransferIx(await findAta(brand, USDC_MINT), vault, brand, budgetUnits));
      return send(ixs, 120_000);
    }, onDone);

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-8 overflow-hidden">
      <Card>
        <p className="mb-4 font-medium">{b.create}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={b.rate}>
            <input className={inputCls} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Field label={b.window}>
            <input className={inputCls} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <Field label={b.attestor}>
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as "me" | "key")}>
              <option value="me">{b.attestorMe}</option>
              <option value="key">{b.attestorKey}</option>
            </select>
          </Field>
          <Field label={`${b.fund} (${t.app.usdc})`}>
            <input className={inputCls} inputMode="decimal" placeholder="0.00" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>
          {mode === "key" && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label={b.attestorAddress}>
                <input className={`${inputCls} font-mono`} value={attestor} onChange={(e) => setAttestor(e.target.value.trim())} />
              </Field>
            </div>
          )}
        </div>
        <div className="mt-5">
          <Button disabled={!valid || tx.busy} onClick={submit}>
            {b.createBtn}
          </Button>
        </div>
        <TxStatus state={tx.state} />
      </Card>
    </motion.div>
  );
}

function CampaignCard({ c, reload }: { c: CampaignJson; reload: () => void }) {
  const { lang, t } = useI18n();
  const b = t.app.brand;
  const { publicKey, signMessage } = useWallet();
  const { connection } = useConnection();
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const fundTx = useTx();
  const saleTx = useTx();
  const [orderId, setOrderId] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [creator, setCreator] = useState("");
  const [rent, setRent] = useState<number | null>(null);

  const me = publicKey?.toBase58() ?? "";
  const isAttestor = me === c.attestor;
  const reserved = BigInt(c.reserved);
  const balance = BigInt(c.vaultBalance);
  const free = balance - reserved;
  const days = Number(BigInt(c.holdSeconds) / 86400n);

  const comsJson = useJson<{ commissions: CommissionJson[] }>(open ? `/api/campaign/${c.address}` : null);
  const coms = comsJson.data === undefined ? null : (comsJson.data?.commissions ?? []);
  const loadComs = comsJson.reload;

  useEffect(() => {
    if (!open || rent !== null) return;
    connection
      .getMinimumBalanceForRentExemption(COMMISSION_LEN)
      .then(setRent)
      .catch(() => {});
  }, [open, rent, connection]);

  const refresh = () => {
    reload();
    loadComs();
  };

  const brand = me ? address(me) : null;
  const amt = amount ? parseUsdc(amount) : null;

  const fund = () =>
    fundTx.run(async () => send([tokenTransferIx(await findAta(brand!, c.mint as Address), c.vault as Address, brand!, amt!)]), refresh);
  const withdraw = () =>
    fundTx.run(async () => {
      const dest = await findAta(brand!, c.mint as Address);
      return send([createAtaIx(brand!, dest, brand!, c.mint as Address), withdrawIx({ brand: brand!, campaign: c.address as Address, vault: c.vault as Address, dest, amount: amt! })]);
    }, refresh);

  const orderUnits = orderAmount ? parseUsdc(orderAmount) : null;
  const saleValid = orderId.trim().length > 0 && orderUnits !== null && orderUnits > 0n && isAddress(creator);
  const record = () =>
    saleTx.run(async () => {
      if (!signMessage) throw new Error("This wallet cannot sign messages, which recording a sale needs.");
      const key = await attestorKey(c.address as Address, signMessage);
      const hash = await orderHash(c.address as Address, orderId.trim(), key);
      const lamports = BigInt(await connection.getMinimumBalanceForRentExemption(COMMISSION_LEN));
      const { instruction } = await recordSaleIx({
        attestor: brand!,
        payer: brand!,
        campaign: c.address as Address,
        vault: c.vault as Address,
        orderHash: hash,
        orderAmount: orderUnits!,
        creator: creator as Address,
        lamports,
      });
      return send([instruction]);
    }, () => {
      setOrderId("");
      setOrderAmount("");
      refresh();
    });

  const share = `${SITE_URL}/${lang}/campaign/${c.address}`;

  return (
    <Card className="p-0">
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left">
        <div>
          <p className="font-mono text-sm">{short(c.address, 6)}</p>
          <p className="mt-1 text-xs text-muted">
            {(c.bps / 100).toFixed(2)}% · {days} {t.app.days} · {isAttestor ? b.attestorMe : short(c.attestor)}
          </p>
        </div>
        <div className="flex items-center gap-8">
          <Stat k={b.stats.free} v={`${usdc(free)}`} />
          <Stat k={b.stats.reserved} v={`${usdc(reserved)}`} tone="text-held" />
          <Stat k={b.stats.paid} v={`${usdc(BigInt(c.paid))}`} tone="text-paid" />
          <ChevronDown size={18} className={`text-muted transition ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-line">
            <div className="grid gap-6 p-5 lg:grid-cols-2">
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium">{b.fund} / {b.withdraw}</p>
                  <div className="flex flex-wrap gap-2">
                    <input className={`${inputCls} max-w-40`} placeholder={b.amount} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <Button disabled={!amt || amt <= 0n || fundTx.busy} onClick={fund}>{b.fund}</Button>
                    <Button tone="ghost" disabled={!amt || amt <= 0n || amt > free || fundTx.busy} onClick={withdraw}>{b.withdraw}</Button>
                  </div>
                  <TxStatus state={fundTx.state} />
                </div>
                {isAttestor && (
                  <div>
                    <p className="mb-2 text-sm font-medium">{b.recordTitle}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className={inputCls} placeholder={b.orderId} value={orderId} onChange={(e) => setOrderId(e.target.value)} />
                      <input className={inputCls} placeholder={b.orderAmount} inputMode="decimal" value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} />
                      <input className={`${inputCls} font-mono sm:col-span-2`} placeholder={b.creatorWallet} value={creator} onChange={(e) => setCreator(e.target.value.trim())} />
                    </div>
                    {orderUnits && orderUnits > 0n && (
                      <p className="mt-2 text-xs text-muted">
                        → <span className="text-held">{usdc(commissionFor(orderUnits, c.bps))} USDC</span>
                      </p>
                    )}
                    <div className="mt-3">
                      <Button disabled={!saleValid || saleTx.busy} onClick={record}>{b.recordBtn}</Button>
                    </div>
                    <TxStatus state={saleTx.state} />
                    {rent !== null && <p className="mt-3 text-xs text-faint">{fmt(b.rentNote, { rent: (rent / 1e9).toFixed(5) })}</p>}
                  </div>
                )}
                <div>
                  <p className="mb-2 text-sm font-medium">{b.share}</p>
                  <div className="flex items-center gap-2">
                    <Link href={`/${lang}/campaign/${c.address}`} className="truncate font-mono text-xs text-muted hover:text-text">{share}</Link>
                    <CopyButton text={share} label={t.app.copy} done={t.app.copied} />
                    <a href={explorerAddress(c.address)} target="_blank" rel="noreferrer" className="text-muted hover:text-text"><ExternalLink size={14} /></a>
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">{b.pending}</p>
                {coms === null ? (
                  <p className="text-sm text-muted">{t.app.loading}</p>
                ) : coms.length === 0 ? (
                  <p className="text-sm text-muted">{t.app.campaign.none}</p>
                ) : (
                  <ul className="space-y-2">
                    {coms.map((m) => (
                      <CommissionRow key={m.address} m={m} c={c} canCancel={isAttestor} onDone={refresh} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function CommissionRow({ m, c, canCancel, onDone }: { m: CommissionJson; c: { address: string; vault: string; mint: string }; canCancel: boolean; onDone: () => void }) {
  const { t } = useI18n();
  const { publicKey } = useWallet();
  const send = useSend();
  const tx = useTx();
  const { left, label } = useCountdown(Number(m.releaseAt));
  const due = left <= 0;
  const me = publicKey ? address(publicKey.toBase58()) : null;

  const release = () =>
    tx.run(async () => {
      const payeeToken = await findAta(m.payee as Address, c.mint as Address);
      const treasuryToken = await findAta(TREASURY, c.mint as Address);
      return send([
        createAtaIx(me!, payeeToken, m.payee as Address, c.mint as Address),
        createAtaIx(me!, treasuryToken, TREASURY, c.mint as Address),
        releaseIx({ campaign: c.address as Address, vault: c.vault as Address, commission: m.address as Address, payeeToken, rentPayer: m.rentPayer as Address, treasuryToken }),
      ]);
    }, onDone);
  const cancel = () =>
    tx.run(async () => send([cancelIx({ attestor: me!, campaign: c.address as Address, commission: m.address as Address, rentPayer: m.rentPayer as Address })]), onDone);

  return (
    <li className="rounded-xl border border-line bg-bg-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tabular font-medium">
            {usdc(BigInt(m.amount))} USDC {m.sold && <span className="ml-1 rounded-full bg-early/15 px-2 py-0.5 text-[11px] text-early">{t.app.creator.sold}</span>}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {t.flow.payee}: {short(m.payee)} · {due ? <span className="text-paid">{t.app.creator.due}</span> : <span className="text-held">{fmt(t.app.creator.releasesIn, { t: label })}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {due && me && <Button onClick={release} disabled={tx.busy}>{t.app.creator.release}</Button>}
          {!due && canCancel && <Button tone="danger" onClick={cancel} disabled={tx.busy}>{t.app.brand.cancel}</Button>}
        </div>
      </div>
      <TxStatus state={tx.state} />
    </li>
  );
}
