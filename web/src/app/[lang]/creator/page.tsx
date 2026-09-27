import type { Metadata } from "next";
import { CreatorDesk } from "@/components/creator-desk";
import { getDictionary, hasLocale } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/creator">): Promise<Metadata> {
  const { lang } = await params;
  return hasLocale(lang) ? { title: getDictionary(lang).app.creator.title } : {};
}

export default function Page() {
  return <CreatorDesk />;
}
