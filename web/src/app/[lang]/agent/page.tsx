import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { hasLocale } from "@/i18n";
import { REPO_URL, SITE_URL } from "@/lib/config";
import { USDC_MINT } from "@/lib/commish/program";
import { demoCampaignAddress, loadDemoCampaign } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay as an agent" };

export default async function AgentPage({ params }: PageProps<"/[lang]/agent">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  let payTo: string | null = null;
  try {
    payTo = (await loadDemoCampaign())?.vault ?? null;
  } catch {}
  const configured = !!demoCampaignAddress();
  const ref = "<YOUR_AGENT_PUBKEY>";
  const curl = `# 1. Ask. No payment yet, so you get 402 and the terms.
curl -i "${SITE_URL}/api/agent/call?ref=${ref}"

# 2. Pay 0.05 USDC (50000 base units) to "payTo" from the 402 body,
#    with memo "commish:${ref}". Keep the tx signature.
#    With the Solana CLI, for example:
spl-token transfer EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 0.05 ${payTo ?? "<payTo>"} \
  --with-memo "commish:${ref}" -u mainnet-beta

# 3. Retry with the signature as proof.
curl "${SITE_URL}/api/agent/call?ref=${ref}" \\
  -H "X-Payment: <TX_SIGNATURE>"

# 200 -> { result, receipt:{ payment, orderHash, commission, releaseAt, explorer } }
# Your 10% cut is held on-chain until releaseAt. No ref = no commission.
#
# Errors are JSON: { code, message, docs }
#   400 invalid ref   402 payment missing/invalid   503 not configured
# Health: ${SITE_URL}/api/agent/health
# x402-compatible, not certified. Raw tx signature, not a facilitator payload.`;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em]">Holdback for machine payments</h1>
        <p className="mt-3 text-muted">A paid call returns HTTP 402. The router agent that referred it earns a cut, and that cut stays locked in USDC until the refund window closes.</p>

        <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
          {[
            ["Price", "0.05 USDC (50000 base units)"],
            ["Asset", USDC_MINT],
            ["payTo", payTo ?? (configured ? "demo campaign unreadable right now" : "demo campaign not configured")],
            ["ref", "your agent public key; memo is commish:<ref>"],
            ["Router cut", "10%, held 600 s on the demo campaign"],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 bg-bg px-4 py-3 sm:grid-cols-[110px_1fr]">
              <dt className="text-muted">{k}</dt>
              <dd className="break-all font-mono text-[13px]">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#flow" className="inline-flex h-11 items-center rounded-xl bg-paid px-5 text-sm font-semibold text-ink hover:brightness-110">Pay as an agent</a>
          <Link href={`/${lang}/docs`} className="inline-flex h-11 items-center rounded-xl border border-line px-5 text-sm font-medium hover:border-line-strong">Read the 6 instructions</Link>
        </div>

        <h2 id="flow" className="mt-14 scroll-mt-24 text-xl font-semibold">The 402 flow</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface-2 p-4 font-mono text-[12.5px] leading-relaxed">{curl}</pre>

        <h2 className="mt-14 text-xl font-semibold">Paid tool: Panta market data</h2>
        <p className="mt-3 text-sm text-muted">
          Add <code className="font-mono">?market=&lt;Panta market address or search text&gt;</code> and the paid call returns that prediction market from the Panta API: title, phase, volume and live YES/NO prices. Payment, holdback and receipt work exactly as above; Panta is the tool being sold. Without <code className="font-mono">market</code> (or while the Panta key is unset) you get the echo result.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface-2 p-4 font-mono text-[12.5px] leading-relaxed">{`curl "${SITE_URL}/api/agent/call?ref=${ref}&market=bitcoin" -H "X-Payment: <TX_SIGNATURE>"`}</pre>

        <p className="mt-8 text-sm text-muted">
          <Link className="underline" href={`/${lang}/live`}>Watch live holdbacks</Link> · <a className="underline" href={`${REPO_URL}/blob/main/README-JUDGES.md`} target="_blank" rel="noreferrer">README-JUDGES on GitHub</a> (github.com/bryankwandou/commish)
        </p>
      </main>
      <Footer />
    </>
  );
}
