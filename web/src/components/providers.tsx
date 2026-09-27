"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { Dictionary, Locale } from "@/i18n";
/** Browser traffic goes through /api/rpc unless a public RPC is configured. */
function endpoint(): string {
  if (process.env.NEXT_PUBLIC_RPC_URL) return process.env.NEXT_PUBLIC_RPC_URL;
  if (typeof window !== "undefined") return `${window.location.origin}/api/rpc`;
  return "https://api.mainnet-beta.solana.com";
}

type I18n = { lang: Locale; t: Dictionary };
const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n outside Providers");
  return v;
}

export function Providers({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  const i18n = useMemo(() => ({ lang, t: dict }), [lang, dict]);
  // Wallet Standard wallets (Phantom, Solflare, Backpack, ...) register
  // themselves, so no adapter list is needed.
  const wallets = useMemo(() => [], []);
  const rpc = useMemo(() => endpoint(), []);
  return (
    <I18nContext.Provider value={i18n}>
      <ConnectionProvider endpoint={rpc} config={{ commitment: "confirmed", wsEndpoint: "wss://api.mainnet-beta.solana.com" }}>
        <WalletProvider wallets={wallets} autoConnect>
          {children}
        </WalletProvider>
      </ConnectionProvider>
    </I18nContext.Provider>
  );
}
