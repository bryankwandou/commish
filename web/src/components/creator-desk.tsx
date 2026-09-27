"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useI18n } from "./providers";
import { AppShell, Button, Card, Field, NeedWallet, Stat, inputCls, useJson, useNow } from "./app-kit";
import { CommissionRow, type CampaignJson, type CommissionJson } from "./brand-console";
import { CopyButton } from "./ui";
import { short, usdc } from "@/lib/config";

type Data = { commissions: CommissionJson[]; campaigns: Record<string, CampaignJson | null> };

export function CreatorDesk() {
  const { lang, t } = useI18n();
  const c = t.app.creator;
  const { publicKey } = useWallet();
  const [shop, setShop] = useState("");
  const wallet = publicKey?.toBase58() ?? null;
  const json = useJson<Data>(wallet && `/api/commissions?wallet=${wallet}`);
  const data = useMemo(() => (json.data === undefined ? null : (json.data ?? { commissions: [], campaigns: {} })), [json.data]);
  const load = json.reload;

  const me = publicKey?.toBase58() ?? "";
  const mine = useMemo(() => data?.commissions.filter((m) => m.payee === me) ?? [], [data, me]);
  const now = useNow();
  const pending = mine.filter((m) => Number(m.releaseAt) > now).reduce((a, m) => a + BigInt(m.amount), 0n);
  const due = mine.filter((m) => Number(m.releaseAt) <= now).reduce((a, m) => a + BigInt(m.amount), 0n);

  const link = useMemo(() => {
    try {
      const u = new URL(shop.trim());
      u.searchParams.set("ref", me);
      return u.toString();
    } catch {
      return "";
    }
  }, [shop, me]);

  return (
    <AppShell
      title={c.title}
      sub={c.sub}
      actions={
        publicKey && (
          <Button tone="ghost" onClick={load}>
            <RefreshCw size={14} /> {t.app.refresh}
          </Button>
        )
      }
    >
      <NeedWallet>
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <Stat k={c.total} v={`${usdc(pending)} USDC`} tone="text-held" />
          </Card>
          <Card>
            <Stat k={c.due} v={`${usdc(due)} USDC`} tone="text-paid" />
          </Card>
          <Card>
            <Field label={c.link} hint={c.linkHint}>
              <input className={inputCls} placeholder="https://shop.example/product" value={shop} onChange={(e) => setShop(e.target.value)} />
            </Field>
            {link && (
              <div className="mt-2 flex items-center gap-2">
                <span className="truncate font-mono text-xs text-muted">{link}</span>
                <CopyButton text={link} label={t.app.copy} done={t.app.copied} />
              </div>
            )}
          </Card>
        </div>

        {data === null ? (
          <p className="text-sm text-muted">{t.app.loading}</p>
        ) : data.commissions.length === 0 ? (
          <Card className="py-12 text-center text-sm text-muted">{c.none}</Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupBy(data.commissions, (m) => m.campaign)).map(([camp, list]) => {
              const cj = data.campaigns[camp];
              if (!cj) return null;
              return (
                <Card key={camp}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/${lang}/campaign/${camp}`} className="font-mono text-sm hover:text-paid">
                      {t.app.campaign.title} {short(camp, 6)}
                    </Link>
                    <span className="text-xs text-muted">{(cj.bps / 100).toFixed(2)}%</span>
                  </div>
                  <ul className="space-y-2">
                    {list.map((m) => (
                      <div key={m.address}>
                        <CommissionRow m={m} c={cj} canCancel={false} onDone={load} />
                        {m.payee === me && !m.sold && Number(m.releaseAt) > now && (
                          <p className="mt-1.5 flex items-start gap-2 px-1 text-xs text-faint">
                            <Zap size={13} className="mt-0.5 shrink-0 text-early" /> {c.earlyOffline}
                          </p>
                        )}
                      </div>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </NeedWallet>
    </AppShell>
  );
}

function groupBy<T>(xs: T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of xs) (out[key(x)] ??= []).push(x);
  return out;
}
