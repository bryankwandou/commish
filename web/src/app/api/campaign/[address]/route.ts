import { isAddress } from "@solana/kit";
import { commissionsFor, getCampaign, toJson, tokenBalance } from "@/lib/chain";

export async function GET(_req: Request, ctx: RouteContext<"/api/campaign/[address]">) {
  const { address } = await ctx.params;
  if (!isAddress(address)) return Response.json({ error: "not an address" }, { status: 400 });
  const c = await getCampaign(address);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  const [vaultBalance, commissions] = await Promise.all([tokenBalance(c.vault), commissionsFor("campaign", address)]);
  return Response.json(toJson({ campaign: c, vaultBalance, commissions: commissions.sort((a, b) => Number(a.releaseAt - b.releaseAt)) }));
}
