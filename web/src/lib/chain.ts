import "server-only";
import { address, type Address } from "@solana/kit";
import {
  CAMPAIGN_LEN,
  COMMISSION_LEN,
  PROGRAM_ID,
  decodeCampaign,
  decodeCommission,
  decodeTokenAccount,
  type Campaign,
  type Commission,
} from "./commish/program";

const RPC = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

async function rpc<T>(method: string, params: unknown[], revalidate = 15): Promise<T> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    next: { revalidate },
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result as T;
}

const b64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

type Filter = { dataSize: number } | { memcmp: { offset: number; bytes: string } };

async function programAccounts(filters: Filter[], revalidate = 15) {
  const res = await rpc<{ pubkey: string; account: { data: [string, string] } }[]>(
    "getProgramAccounts",
    [PROGRAM_ID, { encoding: "base64", filters, commitment: "confirmed" }],
    revalidate,
  );
  return res.map((x) => ({ address: address(x.pubkey), data: b64(x.account.data[0]) }));
}

/** Whether the program account exists and is executable. */
export async function isDeployed(): Promise<boolean> {
  const r = await rpc<{ value: { executable: boolean } | null }>("getAccountInfo", [PROGRAM_ID, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }], 60);
  return !!r.value?.executable;
}

export async function allCampaigns(): Promise<Campaign[]> {
  const xs = await programAccounts([{ dataSize: CAMPAIGN_LEN }], 60);
  return xs.map((x) => decodeCampaign(x.address, x.data)).filter((c): c is Campaign => !!c);
}

export async function allCommissions(): Promise<Commission[]> {
  const xs = await programAccounts([{ dataSize: COMMISSION_LEN }], 60);
  return xs.map((x) => decodeCommission(x.address, x.data)).filter((c): c is Commission => !!c);
}

export async function campaignsByBrand(brand: Address): Promise<Campaign[]> {
  const xs = await programAccounts([{ dataSize: CAMPAIGN_LEN }, { memcmp: { offset: 8, bytes: brand } }], 5);
  return xs.map((x) => decodeCampaign(x.address, x.data)).filter((c): c is Campaign => !!c);
}

export async function commissionsFor(field: "payee" | "creator" | "campaign", key: Address): Promise<Commission[]> {
  const offset = { campaign: 8, creator: 40, payee: 72 }[field];
  const xs = await programAccounts([{ dataSize: COMMISSION_LEN }, { memcmp: { offset, bytes: key } }], 5);
  return xs.map((x) => decodeCommission(x.address, x.data)).filter((c): c is Commission => !!c);
}

export async function getCampaign(a: Address): Promise<Campaign | null> {
  const r = await rpc<{ value: { data: [string, string]; owner: string } | null }>("getAccountInfo", [a, { encoding: "base64", commitment: "confirmed" }], 5);
  if (!r.value || r.value.owner !== PROGRAM_ID) return null;
  return decodeCampaign(a, b64(r.value.data[0]));
}

export async function tokenBalance(a: Address): Promise<bigint> {
  const r = await rpc<{ value: { data: [string, string] } | null }>("getAccountInfo", [a, { encoding: "base64", commitment: "confirmed" }], 5);
  if (!r.value) return 0n;
  return decodeTokenAccount(b64(r.value.data[0]))?.amount ?? 0n;
}

export async function rentFor(len: number): Promise<bigint> {
  return BigInt(await rpc<number>("getMinimumBalanceForRentExemption", [len], 3600));
}

/** JSON-safe view (bigint → string, bytes → hex). */
export function toJson<T>(v: T): unknown {
  return JSON.parse(
    JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x instanceof Uint8Array ? Buffer.from(x).toString("hex") : x)),
  );
}
