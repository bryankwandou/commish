import type { Metadata } from "next";
import { BrandConsole } from "@/components/brand-console";
import { getDictionary, hasLocale } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/brand">): Promise<Metadata> {
  const { lang } = await params;
  return hasLocale(lang) ? { title: getDictionary(lang).app.brand.title } : {};
}

export default function Page() {
  return <BrandConsole />;
}
