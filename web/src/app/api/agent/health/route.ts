import { PROGRAM_ADDRESS } from "@/lib/config";
import { corsHeaders, json, loadDemoCampaign, rpc, vaultBalance } from "@/lib/agent";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  let rpcOk = false;
  let vault: string | null = null;
  let balance: string | null = null;
  try {
    await rpc("getSlot", []);
    rpcOk = true;
    const c = await loadDemoCampaign();
    if (c) {
      vault = c.vault;
      const b = await vaultBalance(c.vault);
      balance = b === null ? null : b.toString();
    }
  } catch {}
  return json({ program: PROGRAM_ADDRESS, rpcOk, vault, vaultUsdcBaseUnits: balance, timestamp: new Date().toISOString() });
}
