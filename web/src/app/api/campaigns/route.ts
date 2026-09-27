import { isAddress } from "@solana/kit";
import { campaignsByBrand, toJson, tokenBalance } from "@/lib/chain";

export async function GET(req: Request) {
  const brand = new URL(req.url).searchParams.get("brand") ?? "";
  if (!isAddress(brand)) return Response.json({ error: "brand must be a Solana address" }, { status: 400 });
  const cs = await campaignsByBrand(brand);
  const withVault = await Promise.all(cs.map(async (c) => ({ ...c, vaultBalance: await tokenBalance(c.vault) })));
  return Response.json(toJson(withVault.sort((a, b) => Number(b.id % 1000n) - Number(a.id % 1000n))));
}
