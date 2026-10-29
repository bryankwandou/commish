// Puts a program ELF at the Commish mainnet id on a local surfpool simnet
// (surfnet_setAccount cheatcode, BPF loader v2). Localnet only.
import { readFileSync } from "node:fs";
const so = process.argv[2] ?? "program/target/deploy/commish.so";
const url = process.env.RPC_URL ?? "http://127.0.0.1:8899";
if (!/127\.0\.0\.1|localhost/.test(url)) { console.error("refusing: not a local RPC"); process.exit(1); }
const body = { jsonrpc: "2.0", id: 1, method: "surfnet_setAccount", params: ["CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB", { lamports: 1_000_000_000, data: readFileSync(so).toString("hex"), owner: "BPFLoader2111111111111111111111111111111111", executable: true }] };
const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
console.log(await r.text());
