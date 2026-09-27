"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { useI18n } from "./providers";
import { PROGRAM_ADDRESS, REPO_URL, explorerAddress, short } from "@/lib/config";

export function Footer() {
  const { lang, t } = useI18n();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="text-sm text-muted">{t.footer.line}</p>
          <p className="font-mono text-xs text-faint">
            program {short(PROGRAM_ADDRESS, 6)}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Link href={`/${lang}/docs`} className="text-muted hover:text-text">{t.footer.docs}</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-muted hover:text-text">{t.footer.source}</a>
          <a href={explorerAddress(PROGRAM_ADDRESS)} target="_blank" rel="noreferrer" className="text-muted hover:text-text">{t.footer.explorer}</a>
          <Link href={`/${lang}/brand`} className="text-muted hover:text-text">{t.nav.brandConsole}</Link>
          <Link href={`/${lang}/creator`} className="text-muted hover:text-text">{t.nav.creatorDesk}</Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 pb-10 text-xs text-faint">© {new Date().getFullYear()} Commish · Apache-2.0</div>
    </footer>
  );
}
