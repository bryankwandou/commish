import { rpcUrl } from "@/lib/solami";
// JSON-RPC pass-through for the browser wallet flow. Only the read and send
// methods the app uses are forwarded, so the upstream endpoint (which may
// carry a private key in RPC_URL) is never exposed or abused.
const UPSTREAM = rpcUrl();
const ALLOWED = new Set([
  "getLatestBlockhash",
  "isBlockhashValid",
  "getAccountInfo",
  "getMultipleAccounts",
  "getBalance",
  "getTokenAccountBalance",
  "getMinimumBalanceForRentExemption",
  "getFeeForMessage",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getTransaction",
  "getBlockHeight",
  "getSlot",
  "getEpochInfo",
  "getGenesisHash",
  "getVersion",
  "simulateTransaction",
  "sendTransaction",
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length > 20 || !calls.every((c) => c && typeof c === "object" && ALLOWED.has((c as { method?: string }).method ?? ""))) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32601, message: "Method not allowed" } }, { status: 403 });
  }
  const r = await fetch(UPSTREAM, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}
