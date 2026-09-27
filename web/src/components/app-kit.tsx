"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "./header";
import { Footer } from "./footer";
import { useI18n } from "./providers";
import { WalletButton } from "./wallet";
import { explorerTx } from "@/lib/config";
import { explain } from "@/lib/tx";

export function AppShell({ title, sub, children, actions }: { title: string; sub?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <Header app />
      <main className="relative min-h-[70vh]">
        <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-72" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-12">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h1>
              {sub && <p className="mt-2 max-w-2xl text-muted">{sub}</p>}
            </div>
            {actions}
          </div>
          <LiveNotice />
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}

/** Whether the program is deployed on mainnet (from /api/stats). */
export function useLive(): boolean | null {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((s) => setLive(!!s.deployed))
      .catch(() => setLive(null));
  }, []);
  return live;
}

function LiveNotice() {
  const { t } = useI18n();
  const live = useLive();
  if (live !== false) return null;
  return (
    <div className="mb-8 flex items-start gap-3 rounded-xl border border-held/40 bg-held/10 p-4 text-sm">
      <CircleAlert size={18} className="mt-0.5 shrink-0 text-held" />
      <p>{t.app.notDeployed}</p>
    </div>
  );
}

export function NeedWallet({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { connected } = useWallet();
  if (connected) return <>{children}</>;
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-surface/40 px-6 py-20 text-center">
      <p className="mb-5 text-muted">{t.app.connectPrompt}</p>
      <WalletButton />
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface/60 p-5 ${className ?? ""}`}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm outline-none transition placeholder:text-faint focus:border-paid/60 focus:ring-2 focus:ring-paid/20";

export function Button({ children, onClick, disabled, tone = "primary", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: "primary" | "ghost" | "danger" | "early"; type?: "button" | "submit" }) {
  const cls = {
    primary: "bg-paid text-ink hover:brightness-110",
    ghost: "border border-line bg-surface-2 hover:border-line-strong",
    danger: "border border-danger/40 text-danger hover:bg-danger/10",
    early: "border border-early/40 text-early hover:bg-early/10",
  }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

export type TxState = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; sig: string } | { kind: "err"; msg: string };

/** Runs a transaction-producing action and tracks its state. */
export function useTx() {
  const [state, setState] = useState<TxState>({ kind: "idle" });
  const run = async (fn: () => Promise<string>, after?: () => void) => {
    setState({ kind: "busy" });
    try {
      const sig = await fn();
      setState({ kind: "ok", sig });
      after?.();
    } catch (e) {
      setState({ kind: "err", msg: explain(e) });
    }
  };
  return { state, run, busy: state.kind === "busy" };
}

export function TxStatus({ state }: { state: TxState }) {
  const { t } = useI18n();
  return (
    <AnimatePresence mode="wait">
      {state.kind !== "idle" && (
        <motion.div key={state.kind} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm">
          {state.kind === "busy" && (
            <p className="flex items-center gap-2 text-muted">
              <Loader2 size={15} className="animate-spin" /> {t.app.signing}
            </p>
          )}
          {state.kind === "ok" && (
            <p className="flex flex-wrap items-center gap-2 text-paid">
              <CircleCheck size={15} /> {t.app.sent}
              <a href={explorerTx(state.sig)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-text hover:underline">
                {t.app.viewTx} <ExternalLink size={12} />
              </a>
            </p>
          )}
          {state.kind === "err" && (
            <p className="flex items-start gap-2 text-danger">
              <CircleAlert size={15} className="mt-0.5 shrink-0" /> {t.app.failed}: {state.msg}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Stat({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{k}</p>
      <p className={`tabular mt-1 text-lg font-semibold tracking-tight ${tone ?? ""}`}>{v}</p>
    </div>
  );
}

/** "3d 4h" style countdown to a unix timestamp, updating every minute. */
/** Unix seconds, refreshed every 30 seconds. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Reads JSON from one of the app's API routes. `data` is undefined while the
 * first response for `url` is pending and null if the request failed; a
 * reload keeps the previous data on screen until the new response lands.
 */
export function useJson<T>(url: string | null): { data: T | null | undefined; reload: () => void } {
  const [tick, setTick] = useState(0);
  const [res, setRes] = useState<{ url: string; data: T | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .catch(() => null)
      .then((data) => {
        if (live) setRes({ url, data });
      });
    return () => {
      live = false;
    };
  }, [url, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data: url && res?.url === url ? res.data : undefined, reload };
}

export function useCountdown(unix: number): { left: number; label: string } {
  const now = useNow();
  const left = Math.max(0, unix - now);
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  return { left, label: d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m` };
}
