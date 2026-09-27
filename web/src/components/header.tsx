"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Globe, Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "./logo";
import { useI18n } from "./providers";
import { WalletButton } from "./wallet";
import { localeNames, locales, type Locale } from "@/i18n";

export function ThemeToggle() {
  const { t } = useI18n();
  // The icon follows data-theme through CSS, so the server render and the
  // first client render agree whatever theme the visitor stored.
  const flip = () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("commish-theme", next);
    } catch {}
  };
  return (
    <button onClick={flip} aria-label={t.nav.theme} title={t.nav.theme} className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text">
      <Moon size={16} className="theme-light-only" />
      <Sun size={16} className="theme-dark-only" />
    </button>
  );
}

export function LocaleSwitch() {
  const { lang, t } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const go = (l: Locale) => {
    setOpen(false);
    const rest = path.split("/").slice(2).join("/");
    router.push(`/${l}${rest ? "/" + rest : ""}${window.location.hash}`);
  };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label={t.nav.language} aria-expanded={open} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted transition hover:bg-surface-2 hover:text-text">
        <Globe size={15} />
        <span className="uppercase">{lang}</span>
        <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-2xl shadow-black/30"
          >
            {locales.map((l) => (
              <li key={l}>
                <button onClick={() => go(l)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
                  {localeNames[l]}
                  {l === lang && <Check size={14} className="text-paid" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header({ landing = false, app = false }: { landing?: boolean; app?: boolean }) {
  const { lang, t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const base = landing ? "" : `/${lang}`;
  const links = app
    ? [
        { href: `/${lang}/brand`, label: t.nav.brandConsole },
        { href: `/${lang}/creator`, label: t.nav.creatorDesk },
        { href: `/${lang}/docs`, label: t.nav.docs },
      ]
    : [
        { href: `${base}#how`, label: t.nav.how },
        { href: `${base}#early`, label: t.nav.early },
        { href: `${base}#brands`, label: t.nav.brands },
        { href: `/${lang}/docs`, label: t.nav.docs },
      ];
  return (
    <header className={`sticky top-0 z-40 transition-colors duration-300 ${scrolled || menu ? "border-b border-line bg-bg/75 backdrop-blur-xl" : "border-b border-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href={`/${lang}`} aria-label="Commish home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-muted transition hover:text-text">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <LocaleSwitch />
          <ThemeToggle />
          {app ? (
            <WalletButton className="ml-1" />
          ) : (
            <Link href={`/${lang}/app`} className="ml-1 hidden h-9 items-center rounded-lg bg-text px-3.5 text-sm font-medium text-bg transition hover:opacity-90 sm:flex">
              {t.nav.open}
            </Link>
          )}
          <button onClick={() => setMenu(!menu)} aria-label="Menu" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 md:hidden">
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line md:hidden">
            <div className="flex flex-col gap-1 px-5 py-3">
              {[...links, { href: `/${lang}/app`, label: t.nav.open }].map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMenu(false)} className="rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-text">
                  {l.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
