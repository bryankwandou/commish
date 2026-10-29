"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { explorerAddress, explorerTx, short } from "@/lib/config";

type Row = { commission: string; status: string; amount: string | null; releaseAt: number | null; due: boolean; payment: string | null; origin: string; closeTx?: string; closedAt?: number | null };
type Data = { campaign: string; timestamp: string; counts: { total: number; soak: number; foreign: number; unknown: number }; rows: Row[] };

function countdown(at: number, now: number) {
  const s = at - now;
  if (s <= 0) return "due now";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h ? h + "h " : ""}${m}m ${s % 60}s`;
}
const utc = (at: number) => new Date(at * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const usdc = (u: string | null) => u === null ? "-" :  (Number(u) / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, ".00");

export default function Live() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const r = await fetch("/api/agent/live", { cache: "no-store" });
        const j = await r.json();
        if (dead) return;
        if (!r.ok) { setError(j.message ?? "error"); setData(null); } else { setError(null); setData(j); }
      } catch {
        if (!dead) setError("Could not reach the API.");
      }
    };
    load();
    const a = setInterval(load, 20_000);
    const b = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => { dead = true; clearInterval(a); clearInterval(b); };
  }, []);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-5 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Live holdbacks</h1>
        <p className="mt-2 text-muted">Commission accounts of the demo campaign, read from Solana mainnet. SOAK means a founder-run transaction; FOREIGN means anyone else.</p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
          {[["Total", data?.counts.total], ["SOAK", data?.counts.soak], ["FOREIGN", data?.counts.foreign]].map(([k, v]) => (
            <div key={k as string} className="rounded-xl border border-line p-4">
              <div className="text-xs text-muted">{k}</div>
              <div className="text-2xl font-semibold">{v ?? "-"}</div>
            </div>
          ))}
        </div>
        {data && data.counts.unknown > 0 && <p className="mt-2 text-xs text-muted">{data.counts.unknown} row(s) could not be matched to a recent payment, so their origin is unknown.</p>}

        {error && <p className="mt-6 rounded-xl border border-line p-4 text-sm">{error}</p>}
        {data && data.rows.length === 0 && <p className="mt-6 rounded-xl border border-line p-4 text-sm text-muted">No commissions for the demo campaign yet.</p>}

        {data && data.rows.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>{["Status", "Amount (USDC)", "Release (UTC)", "Origin", "Explorer"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.rows.map((r) => (
                  <tr key={r.commission}>
                    <td className="px-4 py-2.5">{r.status}</td>
                    <td className="px-4 py-2.5 font-mono">{usdc(r.amount)}</td>
                    <td className="px-4 py-2.5">{r.releaseAt === null ? <div>{r.closedAt ? "closed " + utc(r.closedAt) : "closed"}</div> : <><div>{utc(r.releaseAt)}</div><div className="text-xs text-muted">{countdown(r.releaseAt, now)}</div></>}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.origin}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <a className="underline" href={explorerAddress(r.commission)} target="_blank" rel="noreferrer">{short(r.commission)}</a>
                      {r.payment && <> · <a className="underline" href={explorerTx(r.payment)} target="_blank" rel="noreferrer">payment</a></>}
                      {r.closeTx && <> · <a className="underline" href={explorerTx(r.closeTx)} target="_blank" rel="noreferrer">{r.status.toLowerCase()} tx</a></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <p className="mt-3 text-xs text-muted">Updated {data.timestamp}</p>}
      </main>
      <Footer />
    </>
  );
}
