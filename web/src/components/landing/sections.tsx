"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  Clock3,
  FileLock2,
  Fingerprint,
  Globe2,
  Hash,
  KeyRound,
  Landmark,
  Lock,
  Plus,
  Route,
  Timer,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { useI18n } from "../providers";
import { Counter, CopyButton, Reveal, SectionTitle, Spotlight } from "../ui";
import { Lifecycle } from "./lifecycle";
import { PROGRAM_ADDRESS, explorerAddress, short } from "@/lib/config";

// -------------------------------------------------------------------- hero

export function Hero() {
  const { lang, t } = useI18n();
  const reduce = useReducedMotion();
  const words = t.hero.title.split(" ");
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <h1 className="text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
            {words.map((w, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.08 + i * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                {w}&nbsp;
              </motion.span>
            ))}
          </h1>
          <motion.p initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted">
            {t.hero.sub}
          </motion.p>
          <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-8 flex flex-wrap gap-3">
            <Link href={`/${lang}/brand`} className="group inline-flex h-11 items-center gap-2 rounded-xl bg-paid px-5 text-sm font-semibold text-ink transition hover:brightness-110">
              {t.hero.ctaBrand}
              <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
            </Link>
            <Link href={`/${lang}/creator`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface/60 px-5 text-sm font-medium transition hover:border-line-strong">
              {t.hero.ctaCreator}
            </Link>
          </motion.div>
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-6 flex items-center gap-2 text-xs text-faint">
            <FileLock2 size={14} /> {t.hero.note}
          </motion.p>
        </div>
        <motion.div initial={reduce ? false : { opacity: 0, y: 24, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} style={{ perspective: 1200 }}>
          <Lifecycle />
        </motion.div>
      </div>
      <Marquee />
    </section>
  );
}

function Marquee() {
  const items = ["USDC", "Solana mainnet", "Refund window", "Reserved on-chain", "Permissionless release", "Early payout", "Pinocchio", "Open source", "Non-custodial"];
  const row = [...items, ...items];
  return (
    <div className="relative border-y border-line bg-bg-2/60 py-3 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <div className="marquee flex w-max gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-[0.18em] text-faint">
        {row.map((x, i) => (
          <span key={i} className="flex items-center gap-10">
            {x}
            <span className="size-1 rounded-full bg-line-strong" />
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- proof

type Stats = { deployed: boolean; size: number; campaigns: number; commissions: number; reserved: string; paid: string };

export function Proof() {
  const { t } = useI18n();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setS)
      .catch(() => {});
  }, []);
  const cells = [
    { k: s?.deployed ? t.proof.program : t.proof.pending, v: <a href={explorerAddress(PROGRAM_ADDRESS)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm hover:text-paid">{short(PROGRAM_ADDRESS, 5)}<ArrowUpRight size={13} /></a> },
    { k: t.proof.size, v: <span><Counter value={s?.size ?? 9296} /> <span className="text-sm text-muted">bytes</span></span> },
    { k: t.proof.instructions, v: <Counter value={6} /> },
    { k: t.proof.tests, v: <Counter value={26} /> },
    { k: t.proof.license, v: "Apache-2.0" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-14">
      <Reveal>
        <div className="grid grid-cols-2 divide-line overflow-hidden rounded-2xl border border-line bg-surface/40 sm:grid-cols-5 sm:divide-x">
          {cells.map((c, i) => (
            <div key={i} className={`p-5 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
              <p className="mb-1.5 text-xs text-muted">{c.k}</p>
              <div className="text-xl font-semibold tracking-tight">{c.v}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

// ----------------------------------------------------------------- problem

export function Problem() {
  const { t } = useI18n();
  const icons = [Clock3, Landmark, Globe2];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <SectionTitle title={t.problem.title} />
      <div className="grid gap-4 md:grid-cols-3">
        {t.problem.items.map((it, i) => {
          const Icon = icons[i];
          return (
            <Reveal key={it.t} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-line bg-surface/50 p-6">
                <div className="mb-5 grid size-10 place-items-center rounded-xl border border-line bg-bg-2 text-held">
                  <Icon size={18} />
                </div>
                <h3 className="mb-2 font-semibold tracking-tight">{it.t}</h3>
                <p className="text-sm leading-relaxed text-muted">{it.d}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// --------------------------------------------------------------------- how

export function How() {
  const { t } = useI18n();
  const icons = [PiggyBank, Fingerprint, Timer, Wallet];
  const tones = ["text-text", "text-text", "text-held", "text-paid"];
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-bg-2/50 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <SectionTitle kicker={t.how.kicker} title={t.how.title} />
        <div className="relative grid gap-6 lg:grid-cols-4">
          <motion.div
            className="absolute left-0 right-0 top-[27px] hidden h-px origin-left bg-gradient-to-r from-line-strong via-held to-paid lg:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />
          {t.how.steps.map((s, i) => {
            const Icon = icons[i];
            return (
              <Reveal key={s.t} delay={0.15 + i * 0.18}>
                <div className="relative">
                  <div className={`relative z-10 mb-5 grid size-14 place-items-center rounded-2xl border border-line bg-surface ${tones[i]}`}>
                    <Icon size={22} />
                  </div>
                  <p className="mb-1 font-mono text-xs text-faint">0{i + 1}</p>
                  <h3 className="mb-2 text-lg font-semibold tracking-tight">{s.t}</h3>
                  <p className="text-sm leading-relaxed text-muted">{s.d}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------- rules

export function Rules() {
  const { t } = useI18n();
  const icons = [Lock, Hash, KeyRound, Route, Timer, CircleCheck];
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <SectionTitle kicker={t.rules.kicker} title={t.rules.title} sub={t.rules.sub} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.rules.items.map((r, i) => {
          const Icon = icons[i];
          return (
            <Reveal key={r.t} delay={(i % 3) * 0.08}>
              <Spotlight className="h-full rounded-2xl border border-line bg-surface/50 p-6 transition-colors hover:bg-surface">
                <Icon size={18} className="mb-4 text-paid" />
                <h3 className="mb-2 font-semibold tracking-tight">{r.t}</h3>
                <p className="text-sm leading-relaxed text-muted">{r.d}</p>
              </Spotlight>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------- early

export function Early() {
  const { t } = useI18n();
  const [amount, setAmount] = useState(250);
  const [days, setDays] = useState(21);
  const [disc, setDisc] = useState(2.5);
  const get = amount * (1 - disc / 100);
  const collect = amount * 0.99; // the 1% protocol fee comes out at release
  const apr = useMemo(() => (get > 0 ? (collect / get - 1) * (365 / days) * 100 : 0), [collect, get, days]);
  const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <section id="early" className="scroll-mt-20 border-y border-line bg-bg-2/50 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
        <Reveal>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-early">{t.early.kicker}</p>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{t.early.title}</h2>
          <p className="mt-4 text-pretty text-muted">{t.early.sub}</p>
          <p className="mt-6 border-l-2 border-early/60 pl-4 text-sm text-muted">{t.early.note}</p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-line bg-surface p-6">
            <Slider label={t.early.commission} value={amount} set={setAmount} min={10} max={2000} step={10} show={`${money(amount)} USDC`} />
            <Slider label={t.early.days} value={days} set={setDays} min={1} max={90} step={1} show={`${days}`} />
            <Slider label={t.early.discount} value={disc} set={setDisc} min={1.5} max={10} step={0.5} show={`${disc.toFixed(1)}%`} />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-early/40 bg-early/10 p-4">
                <p className="text-xs text-muted">{t.early.youGet}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-early">
                  <Counter value={get} format={money} />
                </p>
              </div>
              <div className="rounded-xl border border-line bg-bg-2 p-4">
                <p className="text-xs text-muted">{t.early.buyerGets}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  <Counter value={collect} format={money} />
                </p>
              </div>
            </div>
            <p className="mt-4 flex justify-between text-sm text-muted">
              <span>{t.early.apr}</span>
              <span className="tabular font-medium text-text">{apr.toFixed(1)}%</span>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Slider({ label, value, set, min, max, step, show }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; show: string }) {
  return (
    <label className="mb-5 block">
      <span className="mb-2 flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular font-medium">{show}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="w-full" />
    </label>
  );
}

// ------------------------------------------------------------------- sides

export function Sides() {
  const { lang, t } = useI18n();
  const cards = [
    { ...t.sides.brands, href: `/${lang}/brand`, tone: "text-held", id: "brands" },
    { ...t.sides.creators, href: `/${lang}/creator`, tone: "text-paid", id: "creators" },
  ];
  return (
    <section id="brands" className="mx-auto grid max-w-6xl scroll-mt-20 gap-4 px-5 py-24 md:grid-cols-2">
      {cards.map((c, i) => (
        <Reveal key={c.id} delay={i * 0.1}>
          <Spotlight className="flex h-full flex-col rounded-2xl border border-line bg-surface/50 p-7">
            <h3 className={`mb-5 text-xl font-semibold tracking-tight ${c.tone}`}>{c.title}</h3>
            <ul className="mb-8 space-y-3">
              {c.points.map((p) => (
                <li key={p} className="flex gap-3 text-sm text-muted">
                  <CircleCheck size={16} className={`mt-0.5 shrink-0 ${c.tone}`} />
                  {p}
                </li>
              ))}
            </ul>
            <Link href={c.href} className="mt-auto inline-flex w-fit items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:border-line-strong">
              {c.cta} <ArrowRight size={15} />
            </Link>
          </Spotlight>
        </Reveal>
      ))}
    </section>
  );
}

// --------------------------------------------------------------- integrate

const CODE_TS = `// Copy web/src/lib/commish/program.ts from the Commish repository.
import { orderHash, recordSaleIx, COMMISSION_LEN } from "./commish/program";

// Called by your shop when a referred order is paid.
const hash = await orderHash(campaign, order.id, SHOP_SECRET); // HMAC key only your server knows
const { instruction } = await recordSaleIx({
  attestor: attestor.address,   // the key named by the campaign
  payer: attestor.address,      // rent for the commission account
  campaign,
  vault,
  orderHash: hash,
  orderAmount: 250_000000n,     // 250.00 USDC, 6 decimals
  creator: referrerWallet,
  lamports: await rpc.getMinimumBalanceForRentExemption(BigInt(COMMISSION_LEN)).send(),
});
await sendAndConfirm([instruction], [attestor]); // your usual send helper`;

const CODE_HOOK = `order.paid      → record_sale   (reserve the cut)
order.refunded  → cancel        (only inside the window)
window closed   → release       (anyone may call it)

creator wants cash now
                → sell          (buyer pays price, becomes payee)`;

const CODE_ADDR = `program      CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB
usdc mint    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

campaign     PDA ["campaign", brand, id_le_u64]
commission   PDA ["commission", campaign, sha256(order)]
vault        ATA (owner = campaign, mint = usdc)`;

function highlight(code: string) {
  return code.split("\n").map((line, i) => {
    const c = line.indexOf("//");
    const body = c >= 0 ? line.slice(0, c) : line;
    const comment = c >= 0 ? line.slice(c) : "";
    const parts = body.split(/("[^"]*"|\b(?:import|from|const|await|return)\b)/g);
    return (
      <div key={i}>
        {parts.map((p, j) =>
          /^"/.test(p) ? <span key={j} className="text-paid">{p}</span> : /^(import|from|const|await|return)$/.test(p) ? <span key={j} className="text-early">{p}</span> : <span key={j}>{p}</span>,
        )}
        {comment && <span className="text-faint">{comment}</span>}
        {"\n"}
      </div>
    );
  });
}

export function Integrate() {
  const { t } = useI18n();
  const [tab, setTab] = useState(0);
  const codes = [CODE_TS, CODE_HOOK, CODE_ADDR];
  return (
    <section className="border-y border-line bg-bg-2/50 py-24">
      <div className="mx-auto max-w-4xl px-5">
        <SectionTitle kicker={t.integrate.kicker} title={t.integrate.title} sub={t.integrate.sub} />
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-line bg-[#0b0b0e]">
            <div className="flex items-center justify-between border-b border-white/10 px-3">
              <div className="flex">
                {t.integrate.tabs.map((name, i) => (
                  <button key={name} onClick={() => setTab(i)} className={`relative px-3 py-3 text-xs font-medium transition ${tab === i ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                    {name}
                    {tab === i && <motion.span layoutId="tab" className="absolute inset-x-2 -bottom-px h-px bg-paid" />}
                  </button>
                ))}
              </div>
              <CopyButton text={codes[tab]} label={t.integrate.copy} done={t.integrate.copied} />
            </div>
            <AnimatePresence mode="wait">
              <motion.pre key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-zinc-300">
                {highlight(codes[tab])}
              </motion.pre>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------- faq

export function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-3xl px-5 py-24">
      <SectionTitle title={t.faq.title} />
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface/40">
        {t.faq.items.map((f, i) => (
          <div key={f.q}>
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-medium">
              {f.q}
              <Plus size={18} className={`shrink-0 text-muted transition-transform duration-300 ${open === i ? "rotate-45" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <p className="px-6 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------- final

export function Final() {
  const { lang, t } = useI18n();
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-16 text-center">
          <div className="glow pointer-events-none absolute inset-0" />
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">{t.final.title}</h2>
            <p className="mt-4 text-muted">{t.final.sub}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={`/${lang}/brand`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-paid px-5 text-sm font-semibold text-ink transition hover:brightness-110">
                {t.hero.ctaBrand} <ArrowRight size={16} />
              </Link>
              <Link href={`/${lang}/creator`} className="inline-flex h-11 items-center rounded-xl border border-line px-5 text-sm font-medium transition hover:border-line-strong">
                {t.hero.ctaCreator}
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
