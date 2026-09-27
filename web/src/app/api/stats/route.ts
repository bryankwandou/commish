import { allCampaigns, allCommissions, isDeployed } from "@/lib/chain";

export const revalidate = 60;

export async function GET() {
  const size = 9296;
  try {
    const deployed = await isDeployed();
    if (!deployed) return Response.json({ deployed, size, campaigns: 0, commissions: 0, reserved: "0", paid: "0" });
    const [cs, ms] = await Promise.all([allCampaigns(), allCommissions()]);
    return Response.json({
      deployed,
      size,
      campaigns: cs.length,
      commissions: ms.length,
      reserved: cs.reduce((a, c) => a + c.reserved, 0n).toString(),
      paid: cs.reduce((a, c) => a + c.paid, 0n).toString(),
    });
  } catch (e) {
    return Response.json({ deployed: false, size, campaigns: 0, commissions: 0, reserved: "0", paid: "0", error: String(e) }, { status: 200 });
  }
}
