"use client";

import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import type { Instruction } from "@solana/kit";
import { ERRORS } from "./commish/program";

/** kit instruction → web3.js instruction. AccountRole: bit 0 writable, bit 1 signer. */
export function toWeb3(ix: Instruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: (ix.accounts ?? []).map((a) => ({ pubkey: new PublicKey(a.address), isWritable: (a.role & 1) === 1, isSigner: (a.role & 2) === 2 })),
    data: Buffer.from(ix.data ?? new Uint8Array()),
  });
}

/** Turn a wallet or RPC error into a sentence, using the program's error table. */
export function explain(e: unknown): string {
  const text = e instanceof Error ? `${e.message} ${(e as { logs?: string[] }).logs?.join(" ") ?? ""}` : String(e);
  const hex = text.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex) {
    const code = parseInt(hex[1], 16);
    if (ERRORS[code]) return ERRORS[code];
  }
  const dec = text.match(/"Custom":\s*(\d+)/);
  if (dec && ERRORS[Number(dec[1])]) return ERRORS[Number(dec[1])];
  if (/User rejected|rejected the request/i.test(text)) return "The request was rejected in the wallet.";
  if (/insufficient (funds|lamports)|0x1\b/i.test(text)) return "Not enough SOL or USDC in the wallet for this transaction.";
  return text.split("\n")[0].slice(0, 220);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sign with the connected wallet, send, and wait for confirmation by
 * polling (no websocket needed). Adds a small priority fee so the
 * transaction lands promptly on mainnet.
 */
export function useSend() {
  const { connection } = useConnection();
  const wallet = useWallet();
  return useCallback(
    async (ixs: Instruction[], computeUnits = 80_000): Promise<string> => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first.");
      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        ...ixs.map(toWeb3),
      );
      tx.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      const sig = await wallet.sendTransaction(tx, connection, { preflightCommitment: "confirmed" });
      for (;;) {
        const { value } = await connection.getSignatureStatuses([sig]);
        const s = value[0];
        if (s?.err) throw new Error(`Transaction failed: ${JSON.stringify(s.err)}`);
        if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return sig;
        if ((await connection.getBlockHeight("confirmed")) > lastValidBlockHeight) throw new Error("The transaction expired before it was confirmed. Please try again.");
        await sleep(1200);
      }
    },
    [connection, wallet],
  );
}
