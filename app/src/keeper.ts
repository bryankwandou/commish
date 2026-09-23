/**
 * The crank. Every pending commission whose hold has expired gets released.
 *
 * `release` is permissionless on purpose: if this process dies, the creator or
 * anyone else can still pull the money out of the vault. The keeper is a
 * convenience, never a gate.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getProgram, loadKeypair, commissionPda, affiliatePda } from "./anchorClient";

export async function releaseDue(
  connection: Connection,
  cranker: ReturnType<typeof loadKeypair>,
  campaign: PublicKey,
  mint: PublicKey,
): Promise<string[]> {
  const program = getProgram(connection, cranker);
  const now = Math.floor(Date.now() / 1000);
  const all = await program.account.commission.all([
    { memcmp: { offset: 8, bytes: campaign.toBase58() } },
  ]);

  const due = all.filter(
    (c: any) =>
      c.account.status.pending !== undefined &&
      c.account.releaseAt.toNumber() <= now,
  );

  const sent: string[] = [];
  for (const c of due) {
    const wallet = c.account.affiliate as PublicKey;
    try {
      const sig = await program.methods
        .release()
        .accountsPartial({
          cranker: cranker.publicKey,
          campaign,
          mint,
          vault: getAssociatedTokenAddressSync(mint, campaign, true),
          commission: commissionPda(campaign, Array.from(c.account.orderHash)),
          affiliate: affiliatePda(campaign, wallet),
          affiliateWallet: wallet,
          affiliateAta: getAssociatedTokenAddressSync(mint, wallet),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      sent.push(sig);
    } catch (e) {
      console.error(`release failed for ${c.publicKey.toBase58()}:`, e);
    }
  }
  return sent;
}
