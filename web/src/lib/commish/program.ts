/**
 * Commish program client: addresses, account layouts and instruction
 * builders. Framework-free (only @solana/kit primitives), shared by the web
 * app and the program test suite.
 *
 * Instruction data is an 8-byte header (tag in byte 0) followed by the
 * arguments as the program's #[repr(C)] structs, little-endian.
 */
import {
  AccountRole,
  address,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type Instruction,
} from "@solana/kit";

export const PROGRAM_ID = address("CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB");
export const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ATA_PROGRAM = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
/** Circle USDC on Solana mainnet (6 decimals). */
/** Owner of the token account that receives the 1% protocol fee at release. */
export const TREASURY = address("ETcQvsQek2w9feLfsqoe4AypCWfnrSwQiv3djqocaP2m");
export const FEE_BPS = 100;

/** What the payee receives at release: the commission minus the 1% fee (rounded down). */
export function netOfFee(amount: bigint): bigint {
  return amount - amount / BigInt(10_000 / FEE_BPS);
}

export const USDC_MINT = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export const CAMPAIGN_LEN = 176;
export const COMMISSION_LEN = 184;
export const TOKEN_ACCOUNT_LEN = 165;
export const MAX_BPS = 5_000;
export const MAX_HOLD_SECONDS = 90 * 24 * 60 * 60;
export const FLAG_SOLD = 1;

/** Error codes returned by the program (custom program error N). */
export const ERRORS: Record<number, string> = {
  6000: "Invalid instruction",
  6001: "Not enough accounts",
  6002: "A required signature is missing",
  6003: "Account is not the expected record",
  6004: "Signer is not this campaign's attestor",
  6005: "Signer is not this campaign's brand",
  6006: "An account does not match the campaign",
  6007: "Commission rate must be between 0.01% and 50%",
  6008: "Refund window must be between 0 and 90 days",
  6009: "Order is too small to earn a commission",
  6010: "Not enough unreserved budget in the vault",
  6011: "The refund window has not closed yet",
  6012: "The refund window has already closed",
  6013: "Signer or account is not the current payee",
  6014: "Price must be above zero and at most the commission",
  6015: "Arithmetic overflow",
  6016: "Too many accounts",
  6017: "Runtime error",
};

const enc = getAddressEncoder();
const dec = getAddressDecoder();

export type Campaign = {
  address: Address;
  bump: number;
  brand: Address;
  attestor: Address;
  mint: Address;
  vault: Address;
  id: bigint;
  holdSeconds: bigint;
  reserved: bigint;
  paid: bigint;
  bps: number;
};

export type Commission = {
  address: Address;
  bump: number;
  sold: boolean;
  campaign: Address;
  creator: Address;
  payee: Address;
  rentPayer: Address;
  orderHash: Uint8Array;
  amount: bigint;
  releaseAt: bigint;
};

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const key = (b: Uint8Array, o: number) => dec.decode(b.subarray(o, o + 32));

export function decodeCampaign(addr: Address, b: Uint8Array): Campaign | null {
  if (b.length !== CAMPAIGN_LEN || b[0] !== 1) return null;
  const v = view(b);
  return {
    address: addr,
    bump: b[2],
    brand: key(b, 8),
    attestor: key(b, 40),
    mint: key(b, 72),
    vault: key(b, 104),
    id: v.getBigUint64(136, true),
    holdSeconds: v.getBigInt64(144, true),
    reserved: v.getBigUint64(152, true),
    paid: v.getBigUint64(160, true),
    bps: v.getUint16(168, true),
  };
}

export function decodeCommission(addr: Address, b: Uint8Array): Commission | null {
  if (b.length !== COMMISSION_LEN || b[0] !== 2) return null;
  const v = view(b);
  return {
    address: addr,
    bump: b[2],
    sold: (b[3] & FLAG_SOLD) !== 0,
    campaign: key(b, 8),
    creator: key(b, 40),
    payee: key(b, 72),
    rentPayer: key(b, 104),
    orderHash: b.slice(136, 168),
    amount: v.getBigUint64(168, true),
    releaseAt: v.getBigInt64(176, true),
  };
}

/** Owner and amount of an SPL token account. */
export function decodeTokenAccount(b: Uint8Array): { mint: Address; owner: Address; amount: bigint } | null {
  if (b.length !== TOKEN_ACCOUNT_LEN) return null;
  return { mint: key(b, 0), owner: key(b, 32), amount: view(b).getBigUint64(64, true) };
}

// ---------------------------------------------------------------- addresses

const u64le = (n: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
};

export async function findCampaign(brand: Address, id: bigint) {
  const [addr, bump] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [new TextEncoder().encode("campaign"), enc.encode(brand), u64le(id)],
  });
  return { address: addr, bump };
}

export async function findCommission(campaign: Address, orderHash: Uint8Array) {
  const [addr, bump] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [new TextEncoder().encode("commission"), enc.encode(campaign), orderHash],
  });
  return { address: addr, bump };
}

export async function findAta(owner: Address, mint: Address) {
  const [addr] = await getProgramDerivedAddress({
    programAddress: ATA_PROGRAM,
    seeds: [enc.encode(owner), enc.encode(TOKEN_PROGRAM), enc.encode(mint)],
  });
  return addr;
}

/**
 * Order hash committed on-chain, which also fixes the commission's address.
 *
 * With a `key` (recommended): HMAC-SHA256(key, "commish:v1" | campaign | order id).
 * The address then cannot be predicted by anyone without the key. Without one,
 * an outsider who can guess the next order id (shops often number orders in
 * sequence) can send a few lamports to that address first, and record_sale for
 * that order fails, because a new account cannot be created where lamports
 * already sit. The key is the attestor's secret: an HMAC secret on a shop
 * server, or `attestorKey()` for a wallet. The same key and order id always give
 * the same hash, so an order still cannot be recorded twice while its
 * commission is open.
 *
 * Without a key: sha256("commish:v1" | campaign | order id). Only safe for order
 * ids that are already unguessable, such as random UUIDs.
 */
export async function orderHash(campaign: Address, orderId: string, key?: Uint8Array): Promise<Uint8Array> {
  const pre = new Uint8Array([...new TextEncoder().encode("commish:v1"), ...enc.encode(campaign), ...new TextEncoder().encode(orderId)]);
  if (!key) return new Uint8Array(await crypto.subtle.digest("SHA-256", pre));
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, pre as BufferSource));
}

/**
 * A per-campaign HMAC key for an attestor that signs from a wallet. Wallet
 * signatures (ed25519) are deterministic, so the same wallet always derives the
 * same key for a campaign, and nobody else can.
 */
export async function attestorKey(campaign: Address, signMessage: (m: Uint8Array) => Promise<Uint8Array>): Promise<Uint8Array> {
  const sig = await signMessage(new TextEncoder().encode(`Commish order key v1 for campaign ${campaign}. Signing this costs nothing and moves no funds.`));
  return new Uint8Array(await crypto.subtle.digest("SHA-256", sig as BufferSource));
}

/** A random campaign id (u64), so campaign addresses cannot be guessed. */
export function randomCampaignId(): bigint {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return new DataView(b.buffer).getBigUint64(0, true);
}

// ------------------------------------------------------------- instructions

const ro = (a: Address) => ({ address: a, role: AccountRole.READONLY });
const w = (a: Address) => ({ address: a, role: AccountRole.WRITABLE });
const s = (a: Address) => ({ address: a, role: AccountRole.READONLY_SIGNER });
const ws = (a: Address) => ({ address: a, role: AccountRole.WRITABLE_SIGNER });

function data(tag: number, argLen: number, fill?: (v: DataView, b: Uint8Array) => void): Uint8Array {
  const b = new Uint8Array(8 + argLen);
  b[0] = tag;
  if (fill) fill(new DataView(b.buffer, 8), b.subarray(8));
  return b;
}

/** ATA program `CreateIdempotent`. */
export function createAtaIx(payer: Address, ata: Address, owner: Address, mint: Address): Instruction {
  return {
    programAddress: ATA_PROGRAM,
    accounts: [ws(payer), w(ata), ro(owner), ro(mint), ro(SYSTEM_PROGRAM), ro(TOKEN_PROGRAM)],
    data: new Uint8Array([1]),
  };
}

/** SPL Token `Transfer` (legacy program). */
export function tokenTransferIx(from: Address, to: Address, authority: Address, amount: bigint): Instruction {
  const b = new Uint8Array(9);
  b[0] = 3;
  new DataView(b.buffer).setBigUint64(1, amount, true);
  return { programAddress: TOKEN_PROGRAM, accounts: [w(from), w(to), s(authority)], data: b };
}

export type CreateCampaignParams = {
  brand: Address;
  id: bigint;
  bps: number;
  holdSeconds: bigint;
  attestor: Address;
  mint: Address;
  /** Rent-exempt minimum for CAMPAIGN_LEN bytes. */
  lamports: bigint;
};

/** Creates the campaign's vault (its ATA) and the campaign record. */
export async function createCampaignIxs(p: CreateCampaignParams): Promise<{ campaign: Address; vault: Address; instructions: Instruction[] }> {
  const { address: campaign, bump } = await findCampaign(p.brand, p.id);
  const vault = await findAta(campaign, p.mint);
  const ix: Instruction = {
    programAddress: PROGRAM_ID,
    accounts: [ws(p.brand), w(campaign), ro(vault), ro(p.mint), ro(SYSTEM_PROGRAM)],
    data: data(0, 64, (v, b) => {
      v.setBigUint64(0, p.id, true);
      v.setBigInt64(8, p.holdSeconds, true);
      v.setUint16(16, p.bps, true);
      v.setUint8(18, bump);
      v.setBigUint64(24, p.lamports, true);
      b.set(enc.encode(p.attestor), 32);
    }),
  };
  return { campaign, vault, instructions: [createAtaIx(p.brand, vault, campaign, p.mint), ix] };
}

export type RecordSaleParams = {
  attestor: Address;
  payer: Address;
  campaign: Address;
  vault: Address;
  orderHash: Uint8Array;
  orderAmount: bigint;
  creator: Address;
  /** Rent-exempt minimum for COMMISSION_LEN bytes; returned when the commission closes. */
  lamports: bigint;
};

export async function recordSaleIx(p: RecordSaleParams): Promise<{ commission: Address; instruction: Instruction }> {
  const { address: commission, bump } = await findCommission(p.campaign, p.orderHash);
  const accounts = p.attestor === p.payer
    ? [ws(p.attestor), ws(p.payer)]
    : [s(p.attestor), ws(p.payer)];
  return {
    commission,
    instruction: {
      programAddress: PROGRAM_ID,
      accounts: [...accounts, w(p.campaign), ro(p.vault), w(commission), ro(SYSTEM_PROGRAM)],
      data: data(1, 88, (v, b) => {
        b.set(p.orderHash, 0);
        v.setBigUint64(32, p.orderAmount, true);
        b.set(enc.encode(p.creator), 40);
        v.setBigUint64(72, p.lamports, true);
        v.setUint8(80, bump);
      }),
    },
  };
}

export function cancelIx(p: { attestor: Address; campaign: Address; commission: Address; rentPayer: Address }): Instruction {
  const attestor = p.attestor === p.rentPayer ? ws(p.attestor) : s(p.attestor);
  return {
    programAddress: PROGRAM_ID,
    accounts: [attestor, w(p.campaign), w(p.commission), w(p.rentPayer)],
    data: data(2, 0),
  };
}

/** `treasuryToken` is the TREASURY's token account for the campaign mint (see findAta). */
export function releaseIx(p: { campaign: Address; vault: Address; commission: Address; payeeToken: Address; rentPayer: Address; treasuryToken: Address }): Instruction {
  return {
    programAddress: PROGRAM_ID,
    accounts: [w(p.campaign), w(p.vault), w(p.commission), w(p.payeeToken), w(p.rentPayer), ro(TOKEN_PROGRAM), w(p.treasuryToken)],
    data: data(3, 0),
  };
}

export function withdrawIx(p: { brand: Address; campaign: Address; vault: Address; dest: Address; amount: bigint }): Instruction {
  return {
    programAddress: PROGRAM_ID,
    accounts: [s(p.brand), ro(p.campaign), w(p.vault), w(p.dest), ro(TOKEN_PROGRAM)],
    data: data(4, 8, (v) => v.setBigUint64(0, p.amount, true)),
  };
}

export function sellIx(p: { payee: Address; buyer: Address; campaign: Address; commission: Address; buyerToken: Address; payeeToken: Address; price: bigint }): Instruction {
  return {
    programAddress: PROGRAM_ID,
    accounts: [s(p.payee), s(p.buyer), ro(p.campaign), w(p.commission), w(p.buyerToken), w(p.payeeToken), ro(TOKEN_PROGRAM)],
    data: data(5, 8, (v) => v.setBigUint64(0, p.price, true)),
  };
}

/** Commission for an order at `bps`, rounded down exactly like the program. */
export function commissionFor(orderAmount: bigint, bps: number): bigint {
  const b = BigInt(bps);
  return (orderAmount / 10_000n) * b + ((orderAmount % 10_000n) * b) / 10_000n;
}

/** Human-readable reason for a failed Commish transaction, if it is ours. */
export function explainError(code: number): string | undefined {
  return ERRORS[code];
}
