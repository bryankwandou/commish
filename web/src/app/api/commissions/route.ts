import { isAddress } from "@solana/kit";
import { commissionsFor, getCampaign, toJson } from "@/lib/chain";

/** Open commissions where the wallet is the payee or the original creator. */
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet") ?? "";
  if (!isAddress(wallet)) return Response.json({ error: "wallet must be a Solana address" }, { status: 400 });
  const [asPayee, asCreator] = await Promise.all([commissionsFor("payee", wallet), commissionsFor("creator", wallet)]);
  const seen = new Map(asPayee.concat(asCreator).map((m) => [m.address, m]));
  const list = [...seen.values()].sort((a, b) => Number(a.releaseAt - b.releaseAt));
  const campaigns = Object.fromEntries(
    await Promise.all([...new Set(list.map((m) => m.campaign))].map(async (a) => [a, await getCampaign(a)] as const)),
  );
  return Response.json(toJson({ commissions: list, campaigns }));
}
