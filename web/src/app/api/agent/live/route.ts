import { commissionsFor } from "@/lib/chain";
import { PROGRAM_ID } from "@/lib/commish/program";
import { commissionPda, corsHeaders, err, firstByteB58, founderKeys, getTx, json, limited, loadDemoCampaign, rpc, rpcDown } from "@/lib/agent";

let cache: { at: number; body: unknown } | null = null;
const TTL = 30_000;
const MAX_CLOSED_SCAN = 40;

type Closed = { commission: string; status: "Released" | "Cancelled"; payment: string; closeTx: string; closedAt: number | null; feePayer: string | null; origin: string };

/** Closed commissions: the PDA's newest tx carries the Commish ix; data[0] 2=cancel, 3=release. */
async function closedHistory(campaign: string, vault: string, openPdas: Set<string>, founders: Set<string>): Promise<Closed[]> {
  const sigs = await rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [vault, { limit: 100, commitment: "confirmed" }]);
  const cands: { sig: string; pda: string }[] = [];
  for (const s of sigs) {
    if (s.err) continue;
    const pda = (await commissionPda(campaign as never, s.signature)).pda;
    if (!openPdas.has(pda)) cands.push({ sig: s.signature, pda });
    if (cands.length >= MAX_CLOSED_SCAN) break;
  }
  const out: Closed[] = [];
  for (let i = 0; i < cands.length; i += 3) {
    const part = await Promise.all(
      cands.slice(i, i + 3).map(async ({ sig, pda }): Promise<Closed | null> => {
        const last = await rpc<{ signature: string; err: unknown; blockTime: number | null }[]>("getSignaturesForAddress", [pda, { limit: 1, commitment: "confirmed" }]);
        if (!last.length || last[0].err) return null;
        const tx = await getTx(last[0].signature);
        const ix = tx?.transaction.message.instructions.find((x) => (x as { programId?: string }).programId === PROGRAM_ID) as { data?: string } | undefined;
        const d = ix?.data ? firstByteB58(ix.data) : null;
        if (d !== 2 && d !== 3) return null;
        let feePayer: string | null = null;
        try { feePayer = (await getTx(sig))?.transaction.message.accountKeys[0].pubkey ?? null; } catch {}
        return {
          commission: pda,
          status: d === 3 ? "Released" : "Cancelled",
          payment: sig,
          closeTx: last[0].signature,
          closedAt: last[0].blockTime,
          feePayer,
          origin: feePayer === null ? "UNKNOWN" : founders.has(feePayer) ? "SOAK" : "FOREIGN",
        };
      }),
    );
    for (const c of part) if (c) out.push(c);
  }
  return out;
}

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    if (limited(req, 20)) return err(429, "rate_limited", "Too many requests.", { "retry-after": "60" });
    if (cache && Date.now() - cache.at < TTL) return json(cache.body);
    const campaign = await loadDemoCampaign();
    if (!campaign) return err(503, "demo_campaign_not_configured", "demo campaign not configured");
    const commissions = await commissionsFor("campaign", campaign.address);
    const founders = new Set(founderKeys());

    // Map recent vault payments to commission PDAs to learn each payment's fee payer.
    const byPda = new Map<string, string>();
    if (commissions.length) {
      const sigs = await rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [campaign.vault, { limit: 50, commitment: "confirmed" }]);
      for (const s of sigs) {
        if (s.err) continue;
        byPda.set((await commissionPda(campaign.address, s.signature)).pda, s.signature);
      }
    }
    const now = Math.floor(Date.now() / 1000);
    const rows = await Promise.all(
      commissions.map(async (c) => {
        const payment = byPda.get(c.address) ?? null;
        let feePayer: string | null = null;
        if (payment) {
          try {
            feePayer = (await getTx(payment))?.transaction.message.accountKeys[0].pubkey ?? null;
          } catch {}
        }
        const origin = feePayer === null ? "UNKNOWN" : founders.has(feePayer) ? "SOAK" : "FOREIGN";
        return {
          commission: c.address,
          status: c.sold ? "Sold" : "Held",
          amount: c.amount.toString(),
          releaseAt: Number(c.releaseAt),
          due: Number(c.releaseAt) <= now,
          payment,
          feePayer,
          origin,
        };
      }),
    );
    const closed = await closedHistory(campaign.address, campaign.vault, new Set(commissions.map((c) => c.address)), founders);
    const all = [...rows, ...closed.map((c) => ({ ...c, amount: null, releaseAt: null, due: false }))];
    const body = {
      campaign: campaign.address,
      timestamp: new Date().toISOString(),
      counts: {
        total: all.length,
        soak: all.filter((r) => r.origin === "SOAK").length,
        foreign: all.filter((r) => r.origin === "FOREIGN").length,
        unknown: all.filter((r) => r.origin === "UNKNOWN").length,
      },
      rows: all,
    };
    cache = { at: Date.now(), body };
    return json(body);
  } catch {
    return rpcDown();
  }
}
