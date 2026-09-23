import * as anchor from "@coral-xyz/anchor";
import { createHash } from "crypto";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import idl from "../../target/idl/commish.json";

export const PROGRAM_ID = new PublicKey(idl.address);

export const orderHash = (shop: string, orderId: string): number[] =>
  Array.from(createHash("sha256").update(`${shop}:${orderId}`).digest());

export function loadKeypair(json: string): Keypair {
  return Keypair.fromSecretKey(Buffer.from(JSON.parse(json)));
}

export function getProgram(connection: Connection, signer: Keypair) {
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(signer),
    { commitment: "confirmed" },
  );
  return new anchor.Program(idl as anchor.Idl, provider) as any;
}

export const campaignPda = (brand: PublicKey, id: anchor.BN) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), brand.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID,
  )[0];

export const affiliatePda = (campaign: PublicKey, wallet: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("affiliate"), campaign.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID,
  )[0];

export const commissionPda = (campaign: PublicKey, hash: number[]) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("commission"), campaign.toBuffer(), Buffer.from(hash)],
    PROGRAM_ID,
  )[0];

export const vaultAta = (campaign: PublicKey, mint: PublicKey) =>
  getAssociatedTokenAddressSync(mint, campaign, true);

export const TOKEN = { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID };
export { getAssociatedTokenAddressSync };
