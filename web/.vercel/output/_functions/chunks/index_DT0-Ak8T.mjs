import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { d as renderHead, l as renderTemplate, p as createRenderInstruction } from "./server_CxnKLxcG.mjs";
import { t as createComponent } from "./compiler_BczrwrOf.mjs";
//#region node_modules/astro/dist/runtime/server/render/script.js
async function renderScript(result, id) {
	const inlined = result.inlinedScripts.get(id);
	let content = "";
	if (inlined != null) {
		if (inlined) content = `<script type="module">${inlined}<\/script>`;
	} else {
		const resolved = await result.resolve(id);
		content = `<script type="module" src="${result.userAssetsBase ? (result.base === "/" ? "" : result.base) + result.userAssetsBase : ""}${resolved}"><\/script>`;
	}
	return createRenderInstruction({
		type: "script",
		id,
		content
	});
}
//#endregion
//#region src/pages/index.astro
var pages_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	url: () => ""
});
var $$Index = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Commish</title>${renderHead($$result)}</head><body class="bg-neutral-950 text-neutral-100 font-sans"><main class="mx-auto max-w-3xl p-4 space-y-6"><header><h1 class="text-2xl font-semibold">Commish</h1><p class="text-neutral-400 text-sm">Affiliate commissions locked on-chain until the refund window closes, then paid automatically. Creators can sell a pending commission today.</p><p id="meta" class="text-xs text-neutral-500 font-mono break-all mt-2">Loading…</p></header><section class="grid grid-cols-2 sm:grid-cols-4 gap-3" id="stats"></section><form id="buy" class="flex gap-2 items-end"><label class="flex flex-col text-sm">Order amount (USDC)<input name="amount" type="number" min="1" step="0.01" value="120" class="mt-1 rounded bg-neutral-900 border border-neutral-700 px-3 py-2 font-mono tabular-nums"></label><button class="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 focus-visible:ring-2 focus-visible:ring-emerald-300">Customer buys</button></form><p id="msg" class="text-sm min-h-5" role="status"></p><section><h2 class="font-semibold mb-2">Orders</h2><div id="orders" class="space-y-2"></div></section></main>${renderScript($$result, "E:/000VSCODE PROJECT MULAI DARI DESEMBER 2025/commish/web/src/pages/index.astro?astro&type=script&index=0&lang.ts")}</body></html>`;
}, "E:/000VSCODE PROJECT MULAI DARI DESEMBER 2025/commish/web/src/pages/index.astro", void 0);
var $$file = "E:/000VSCODE PROJECT MULAI DARI DESEMBER 2025/commish/web/src/pages/index.astro";
//#endregion
//#region \0virtual:astro:page:src/pages/index@_@astro
var page = () => pages_exports;
//#endregion
export { page };
