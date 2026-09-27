import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Early, Faq, Final, Hero, How, Integrate, Problem, Proof, Rules, Sides } from "@/components/landing/sections";

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
