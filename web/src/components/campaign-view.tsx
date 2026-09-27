"use client";

import { ExternalLink } from "lucide-react";
import { useI18n } from "./providers";
import { AppShell, Card, Stat, useJson } from "./app-kit";
import { CommissionRow, type CommissionJson } from "./brand-console";
import { CopyButton } from "./ui";
import { SITE_URL, explorerAddress, short, usdc } from "@/lib/config";

type Data = {
  campaign: { address: string; brand: string; attestor: string; mint: string; vault: string; holdSeconds: string; reserved: string; paid: string; bps: number };
  vaultBalance: string;
  commissions: CommissionJson[];
};

export function CampaignView({ address }: { address: string }) {
  const { lang, t } = useI18n();
  const cv = t.app.campaign;
  const json = useJson<Data>(`/api/campaign/${address}`);
  const data = json.data === undefined ? null : (json.data ?? "missing");
  const load = json.reload;

  const share = `${SITE_URL}/${lang}/campaign/${address}`;

  return (
    <AppShell title={`${cv.title} ${short(address, 6)}`} actions={<CopyButton text={share} label={t.app.copy} done={t.app.copied} />}>
      {data === null ? (
        <p className="text-sm text-muted">{t.app.loading}</p>
      ) : data === "missing" ? (
        <Card className="py-12 text-center text-sm text-muted">{cv.notFound}</Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="grid gap-6 sm:grid-cols-4">
              <Stat k={t.app.brand.stats.budget} v={`${usdc(BigInt(data.vaultBalance))}`} />
              <Stat k={t.app.brand.stats.reserved} v={`${usdc(BigInt(data.campaign.reserved))}`} tone="text-held" />
              <Stat k={t.app.brand.stats.paid} v={`${usdc(BigInt(data.campaign.paid))}`} tone="text-paid" />
              <Stat k={cv.rate} v={`${(data.campaign.bps / 100).toFixed(2)}% · ${Number(BigInt(data.campaign.holdSeconds) / 86400n)} ${t.app.days}`} />
            </div>
            <dl className="mt-6 grid gap-3 border-t border-line pt-5 text-sm sm:grid-cols-3">
              {[
                [cv.brand, data.campaign.brand],
                [cv.attestor, data.campaign.attestor],
                [cv.vault, data.campaign.vault],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd>
                    <a href={explorerAddress(v)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono hover:text-paid">
                      {short(v, 6)} <ExternalLink size={12} />
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <p className="mb-3 font-medium">{cv.open}</p>
            {data.commissions.length === 0 ? (
              <p className="text-sm text-muted">{cv.none}</p>
            ) : (
              <ul className="space-y-2">
                {data.commissions.map((m) => (
                  <CommissionRow key={m.address} m={m} c={data.campaign} canCancel={false} onDone={load} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
