import { after } from "next/server";
import { PROGRAM_ADDRESS } from "@/lib/config";
import { sweepDue } from "@/lib/relayer";
import { corsHeaders, json, loadDemoCampaign, rpc, vaultBalance } from "@/lib/agent";
import { rpcFastUrl } from "@/lib/rpcfast";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      // A cron hitting /health doubles as the keeper.
      after(() => sweepDue(c).catch(() => {}));
      vault = c.vault;
      const b = await vaultBalance(c.vault);
      balance = b === null ? null : b.toString();
    }
  } catch {}
  // The failover RPC is probed on its own, so a dead fallback shows up before it is needed.
  let fallbackRpcOk: boolean | null = null;
  const fb = rpcFastUrl();
  if (fb) {
    try {
      const r = await fetch(fb, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }), cache: "no-store", signal: AbortSignal.timeout(10_000) });
      fallbackRpcOk = r.ok && typeof (await r.json()).result === "number";
    } catch {
      fallbackRpcOk = false;
    }
  }
  return json({ program: PROGRAM_ADDRESS, rpcOk, fallbackRpc: fb ? "rpcfast" : null, fallbackRpcOk, vault, vaultUsdcBaseUnits: balance, timestamp: new Date().toISOString() });
}
