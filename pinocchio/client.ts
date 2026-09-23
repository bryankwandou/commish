// Hand-written client for the Pinocchio build: instruction builders and
// account decoders that replace the Anchor IDL.
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { createHash } from "crypto";

export const PROGRAM_ID = new PublicKey(
  "F5ZfVzJ9i9bdu18sS3SHjitbvErKrS6XdBYU52Kc8ijW",
);

export const ERRORS = [
  "InvalidCommission", "InvalidHold", "WrongAttestor", "WrongBrand",
  "WrongAffiliate", "ZeroCommission", "InsufficientBudget", "NotPending",
  "StillHeld", "MathOverflow", "WrongAccount", "NotSeller",
] as const;

/** "custom program error: 0x1777" → "StillHeld". */
export const errorName = (e: unknown): string | undefined => {
  const m = String(e).match(/custom program error: 0x([0-9a-f]+)/i);
  return m ? ERRORS[parseInt(m[1], 16) - 6000] : undefined;
};

export const orderHash = (id: string) =>
  createHash("sha256").update(id).digest();

const u64 = (n: bigint | number) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

const campaignPdaBump = (brand: PublicKey, id: bigint) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), brand.toBuffer(), u64(id)],
    PROGRAM_ID,
  );
export const campaignPda = (brand: PublicKey, id: bigint) => campaignPdaBump(brand, id)[0];
const vaultPdaBump = (campaign: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("vault"), campaign.toBuffer()], PROGRAM_ID);
const affiliatePdaBump = (campaign: PublicKey, wallet: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("affiliate"), campaign.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID,
  );
export const affiliatePda = (campaign: PublicKey, wallet: PublicKey) =>
  affiliatePdaBump(campaign, wallet)[0];
export const commissionPda = (campaign: PublicKey, hash: Buffer) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("commission"), campaign.toBuffer(), hash],
    PROGRAM_ID,
  )[0];
/** The campaign vault (a program-derived token account; `mint` kept for call-site symmetry). */
export const vaultAta = (_mint: PublicKey, campaign: PublicKey) => vaultPdaBump(campaign)[0];

const ix = (keys: [PublicKey, boolean, boolean][], data: Buffer) =>
  new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: keys.map(([pubkey, isSigner, isWritable]) => ({ pubkey, isSigner, isWritable })),
    data,
  });

const TP = TOKEN_PROGRAM_ID;
const ATA = ASSOCIATED_TOKEN_PROGRAM_ID;
const SYS = SystemProgram.programId;

export const createCampaign = (a: {
  brand: PublicKey; mint: PublicKey; id: bigint; bps: number; hold: number; attestor: PublicKey;
}) => {
  const [campaign, bump] = campaignPdaBump(a.brand, a.id);
  const [vault, vaultBump] = vaultPdaBump(campaign);
  const bps = Buffer.alloc(2);
  bps.writeUInt16LE(a.bps);
  const hold = Buffer.alloc(8);
  hold.writeBigInt64LE(BigInt(a.hold));
  return ix(
    [
      [a.brand, true, true], [a.mint, false, false], [campaign, false, true],
      [vault, false, true], [TP, false, false], [SYS, false, false],
    ],
    Buffer.concat([Buffer.from([0]), u64(a.id), bps, hold, a.attestor.toBuffer(), Buffer.from([bump, vaultBump])]),
  );
};

export const joinCampaign = (wallet: PublicKey, campaign: PublicKey) =>
  ix(
    [[wallet, true, true], [campaign, false, false],
     [affiliatePda(campaign, wallet), false, true], [SYS, false, false]],
    Buffer.from([1, affiliatePdaBump(campaign, wallet)[1]]),
  );

export const recordSale = (a: {
  attestor: PublicKey; campaign: PublicKey; mint: PublicKey; affiliate: PublicKey;
  hash: Buffer; orderAmount: bigint | number;
}) =>
  ix(
    [
      [a.attestor, true, true], [a.campaign, false, true],
      [vaultAta(a.mint, a.campaign), false, false], [a.affiliate, false, true],
      [commissionPda(a.campaign, a.hash), false, true], [TP, false, false], [SYS, false, false],
    ],
    Buffer.concat([Buffer.from([2]), a.hash, u64(a.orderAmount)]),
  );

export const cancelCommission = (a: {
  attestor: PublicKey; campaign: PublicKey; affiliate: PublicKey; hash: Buffer;
}) =>
  ix(
    [[a.attestor, true, false], [a.campaign, false, true],
     [commissionPda(a.campaign, a.hash), false, true], [a.affiliate, false, true]],
    Buffer.from([3]),
  );

export const release = (a: {
  cranker: PublicKey; campaign: PublicKey; mint: PublicKey; affiliate: PublicKey;
  hash: Buffer; payee: PublicKey;
}) =>
  ix(
    [
      [a.cranker, true, true], [a.campaign, false, true], [a.mint, false, false],
      [vaultAta(a.mint, a.campaign), false, true],
      [commissionPda(a.campaign, a.hash), false, true], [a.affiliate, false, true],
      [a.payee, false, false],
      [getAssociatedTokenAddressSync(a.mint, a.payee, true), false, true],
      [TP, false, false], [ATA, false, false], [SYS, false, false],
    ],
    Buffer.from([4]),
  );

export const withdraw = (a: {
  brand: PublicKey; campaign: PublicKey; mint: PublicKey; amount: bigint | number;
}) =>
  ix(
    [
      [a.brand, true, true], [a.campaign, false, false], [a.mint, false, false],
      [vaultAta(a.mint, a.campaign), false, true],
      [getAssociatedTokenAddressSync(a.mint, a.brand), false, true],
      [TP, false, false], [ATA, false, false], [SYS, false, false],
    ],
    Buffer.concat([Buffer.from([5]), u64(a.amount)]),
  );

export const sellCommission = (a: {
  seller: PublicKey; buyer: PublicKey; campaign: PublicKey; affiliate: PublicKey;
  mint: PublicKey; hash: Buffer; price: bigint | number;
}) =>
  ix(
    [
      [a.seller, true, false], [a.buyer, true, false], [a.campaign, false, false],
      [commissionPda(a.campaign, a.hash), false, true], [a.affiliate, false, false],
      [a.mint, false, false],
      [getAssociatedTokenAddressSync(a.mint, a.buyer), false, true],
      [getAssociatedTokenAddressSync(a.mint, a.seller), false, true],
      [TP, false, false],
    ],
    Buffer.concat([Buffer.from([6]), u64(a.price)]),
  );

const pk = (d: Buffer, o: number) => new PublicKey(d.subarray(o, o + 32));
const rd = (d: Buffer, o: number) => d.readBigUInt64LE(o);

export const decodeCampaign = (d: Buffer) => ({
  brand: pk(d, 1), attestor: pk(d, 33), mint: pk(d, 65), id: rd(d, 97),
  bps: d.readUInt16LE(105), hold: d.readBigInt64LE(107),
  reserved: rd(d, 115), paid: rd(d, 123), vault: pk(d, 132),
});
export const decodeAffiliate = (d: Buffer) => ({
  campaign: pk(d, 1), wallet: pk(d, 33), pending: rd(d, 65), earned: rd(d, 73),
});
export const STATUS = ["Pending", "Paid", "Cancelled"] as const;
export const decodeCommission = (d: Buffer) => ({
  campaign: pk(d, 1), affiliate: pk(d, 33), payee: pk(d, 65),
  orderHash: d.subarray(97, 129), orderAmount: rd(d, 129), amount: rd(d, 137),
  releaseAt: Number(d.readBigInt64LE(145)), status: STATUS[d[153]],
});
