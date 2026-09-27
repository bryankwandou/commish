"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { LogOut, Wallet, X } from "lucide-react";
import { useI18n } from "./providers";
import { short } from "@/lib/config";

export function WalletButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const { wallets, select, connect, disconnect, connected, connecting, publicKey, wallet } = useWallet();
  const [open, setOpen] = useState(false);

  // With autoConnect on, the provider connects as soon as a wallet is
  // selected; only re-picking the wallet that is already selected needs an
  // explicit connect.
  const pick = (name: WalletName) => {
    if (wallet?.adapter.name === name) connect().catch(() => {});
    else select(name);
    setOpen(false);
  };

  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);

  if (connected && publicKey) {
    return (
      <button onClick={() => disconnect()} title={t.app.disconnect} className={`group inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm transition hover:border-line-strong ${className ?? ""}`}>
        <span className="size-2 rounded-full bg-paid" />
        <span className="font-mono">{short(publicKey.toBase58())}</span>
        <LogOut size={14} className="text-faint group-hover:text-text" />
      </button>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={`inline-flex h-9 items-center gap-2 rounded-lg bg-paid px-3.5 text-sm font-semibold text-ink transition hover:brightness-110 ${className ?? ""}`}>
        <Wallet size={15} />
        {connecting ? t.app.signing : t.app.connect}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold">{t.app.chooseWallet}</p>
                <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2">
                  <X size={16} />
                </button>
              </div>
              {installed.length === 0 ? (
                <p className="text-sm text-muted">{t.app.noWallet}</p>
              ) : (
                <ul className="space-y-2">
                  {installed.map((w) => (
                    <li key={w.adapter.name}>
                      <button
                        onClick={() => pick(w.adapter.name)}
                        className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-3 text-left text-sm font-medium transition hover:border-line-strong hover:bg-surface-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.adapter.icon} alt="" className="size-7 rounded-md" />
                        {w.adapter.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
