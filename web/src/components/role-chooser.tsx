"use client";

import Link from "next/link";
import { ArrowRight, Store, UserRound } from "lucide-react";
import { useI18n } from "./providers";
import { AppShell } from "./app-kit";
import { Reveal, Spotlight } from "./ui";

export function RoleChooser() {
  const { lang, t } = useI18n();
  const roles = [
    { href: `/${lang}/brand`, title: t.nav.brandConsole, sub: t.app.brand.sub, Icon: Store, tone: "text-held" },
    { href: `/${lang}/creator`, title: t.nav.creatorDesk, sub: t.app.creator.sub, Icon: UserRound, tone: "text-paid" },
  ];
  return (
    <AppShell title={t.nav.open}>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map(({ href, title, sub, Icon, tone }, i) => (
          <Reveal key={href} delay={i * 0.08}>
            <Link href={href} className="group block h-full">
              <Spotlight className="h-full rounded-2xl border border-line bg-surface/60 p-7 transition-colors group-hover:bg-surface">
                <Icon size={22} className={`mb-6 ${tone}`} />
                <p className="text-xl font-semibold tracking-tight">{title}</p>
                <p className="mt-2 text-sm text-muted">{sub}</p>
                <ArrowRight size={18} className="mt-8 text-muted transition group-hover:translate-x-1 group-hover:text-text" />
              </Spotlight>
            </Link>
          </Reveal>
        ))}
      </div>
    </AppShell>
  );
}
