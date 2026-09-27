import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Early, Faq, Final, Hero, How, Integrate, Problem, Proof, Rules, Sides } from "@/components/landing/sections";
import { locales } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return {
    alternates: {
      canonical: `/${lang}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
  };
}

export default function Home() {
  return (
    <>
      <Header landing />
      <main>
        <Hero />
        <Proof />
        <Problem />
        <How />
        <Rules />
        <Early />
        <Sides />
        <Integrate />
        <Faq />
        <Final />
      </main>
      <Footer />
    </>
  );
}
