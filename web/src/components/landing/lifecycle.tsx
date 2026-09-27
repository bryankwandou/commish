"use client";

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw, Zap } from "lucide-react";
import { useI18n } from "../providers";
import { fmt } from "@/i18n";

type Stage = "idle" | "held" | "paid";
const WINDOW_DAYS = 7;
const BUDGET = 200;
const CUT = 25;

/**
 * Interactive walk through one commission: record a sale, hold it through
 * the refund window, then either let it pay out or sell it early. Local
 * state only; the real flow runs on the program.
 */
export function Lifecycle() {
  const { t } = useI18n();
  const f = t.flow;
  const [stage, setStage] = useState<Stage>("idle");
  const [sold, setSold] = useState(false);
  const days = useMotionValue(WINDOW_DAYS);
  const [dayLabel, setDayLabel] = useState(WINDOW_DAYS);
  useEffect(() => days.on("change", (v) => setDayLabel(Math.ceil(v))), [days]);
  const remaining = useTransform(days, (v) => v / WINDOW_DAYS);

  const reserved = stage === "held" ? CUT : 0;
  const unreserved = BUDGET - (stage === "idle" ? 0 : CUT);

  const record = () => {
    days.set(WINDOW_DAYS);
    setStage("held");
  };
  const close = () => {
    animate(days, 0, { duration: 1.4, ease: "easeInOut" }).then(() => setStage("paid"));
  };
  const reset = () => {
    setStage("idle");
    setSold(false);
    days.set(WINDOW_DAYS);
  };

  const status = stage === "idle" ? f.idle : stage === "paid" ? (sold ? f.paidBuyer : f.paid) : sold ? f.sold : f.held;
  const active = [stage !== "idle", stage === "held", stage === "paid", sold];
  const tone = ["text-text", "text-held", "text-paid", "text-early"];

  return (
    <div className="relative rounded-2xl border border-line bg-surface/80 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-medium">{f.title}</p>
        <span className="font-mono text-[11px] text-faint">commish · usdc</span>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {f.stages.map((s, i) => (
          <span
            key={s}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-300 ${active[i] ? `border-current ${tone[i]} bg-current/10` : "border-line text-faint"}`}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-5">
        <dl className="space-y-3 text-sm">
          <Row k={f.order} v={f.orderValue} />
          <Row k={f.rate} v={<span className="tabular font-medium">{CUT.toFixed(2)} USDC</span>} />
          <Row
            k={f.payee}
            v={
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={sold ? "b" : "c"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={sold ? "text-early" : ""}
                >
                  {sold ? f.buyer : f.creator}
                </motion.span>
              </AnimatePresence>
            }
          />
        </dl>

        {/* Refund window ring */}
        <div className="relative grid size-28 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" strokeWidth="7" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={stage === "paid" ? "var(--paid)" : "var(--held)"}
              strokeWidth="7"
              strokeLinecap="round"
              pathLength={1}
              style={{ pathLength: stage === "paid" ? 1 : remaining, opacity: stage === "idle" ? 0.3 : 1 }}
            />
          </svg>
          <div className="text-center leading-tight">
            <p className="tabular text-lg font-semibold">{stage === "paid" ? "0" : dayLabel}</p>
            <p className="mx-auto max-w-[4.5rem] text-[10px] leading-tight text-muted">{stage === "paid" ? f.closed : f.window}</p>
          </div>
        </div>
      </div>

      {/* Vault */}
      <div className="mt-5 rounded-xl border border-line bg-bg-2 p-3">
        <div className="mb-2 flex justify-between text-xs text-muted">
          <span>{f.budget}</span>
          <span className="tabular">
            {unreserved.toFixed(2)} / {BUDGET.toFixed(2)}
          </span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full bg-muted/60" animate={{ width: `${(unreserved / BUDGET) * 100}%` }} transition={{ duration: 0.6 }} />
          <motion.div className="h-full bg-held" animate={{ width: `${(reserved / BUDGET) * 100}%` }} transition={{ duration: 0.6 }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={status}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mt-4 min-h-[3.75rem] text-pretty text-sm text-muted"
        >
          {stage === "held" && !sold ? (
            <>
              <span className="text-held">{fmt(f.daysLeft, { n: dayLabel })}. </span>
              {status}
            </>
          ) : (
            status
          )}
        </motion.p>
      </AnimatePresence>

      <div className="mt-4 flex flex-wrap gap-2">
        {stage === "idle" && (
          <Btn onClick={record} primary>
            {f.record} <ArrowRight size={15} />
          </Btn>
        )}
        {stage === "held" && (
          <>
            <Btn onClick={close} primary>
              {f.close} <ArrowRight size={15} />
            </Btn>
            {!sold && (
              <Btn onClick={() => setSold(true)}>
                <Zap size={14} className="text-early" /> {f.early}
              </Btn>
            )}
          </>
        )}
        {stage === "paid" && (
          <Btn onClick={reset}>
            <RotateCcw size={14} /> {f.reset}
          </Btn>
        )}
      </div>

      {/* Payout coin */}
      <AnimatePresence>
        {stage === "paid" && (
          <motion.span
            initial={{ opacity: 0, scale: 0.4, x: 0, y: 40 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.6], x: [0, -30, -90, -120], y: [40, -10, -40, -60] }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="pointer-events-none absolute bottom-24 right-10 grid size-8 place-items-center rounded-full bg-paid text-[10px] font-bold text-ink shadow-lg shadow-paid/40"
          >
            $
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function Btn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${primary ? "bg-paid text-ink hover:brightness-110" : "border border-line bg-surface-2 hover:border-line-strong"}`}
    >
      {children}
    </motion.button>
  );
}
