import type { APIRoute } from "astro";
import * as demo from "../../lib/demo";
import { errorName } from "../../../../pinocchio/client";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ params }) => {
  if (params.action !== "state") return json({ error: "not found" }, 404);
  try {
    return json(await demo.state());
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  const body = await request.json().catch(() => ({}));
  try {
    const run: Record<string, () => Promise<string>> = {
      buy: () => demo.buy(Number(body.amount)),
      refund: () => demo.refund(String(body.order)),
      cashout: () => demo.cashOut(String(body.order)),
      release: () => demo.release(String(body.order)),
    };
    const fn = run[params.action ?? ""];
    if (!fn) return json({ error: "not found" }, 404);
    return json({ signature: await fn() });
  } catch (e: any) {
    const logs = (e?.logs ?? e?.transactionLogs ?? []).join("\n");
    return json({ error: errorName(e) ?? errorName(logs) ?? String(e.message ?? e) }, 400);
  }
};
