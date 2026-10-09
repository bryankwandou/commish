import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { hasLocale } from "@/i18n";
import { PROGRAM_ADDRESS, REPO_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Demo: one full x402 cycle on Solana mainnet",
  description: "An agent pays 0.05 USDC, the router's cut is held on-chain for 10 minutes, then released. Recorded 6 Oct 2026.",
  openGraph: { videos: [{ url: "/demo/commish-x402-demo.mp4", type: "video/mp4", width: 1920, height: 1080 }], images: ["/demo/poster.jpg"] },
};

const TX = [
  ["13:22:52 UTC", "Agent pays 0.05 USDC into the vault", "47MtDwTYEsu4xmNyizqXSuvpbgRwmS1g76W4UdnqBUYFBwpUWE763SUXFVaDxC3onKpUR6cZ1Xb4EbFryHSR12SP"],
  ["13:22:54 UTC", "Relayer records it, 0.005 USDC held", "2GXGEqG92tbFqummdYMSePphoGHmemWcWN1F6qfr9Ho5daGJKyHXSsJNNLApkXaeja2YKxeGCUYX7vV7XXFKD5F5"],
  ["13:33:12 UTC", "Keeper releases 0.00495 USDC to the router", "5UP1zaytSZYa8H6p6xFJSd8fccJLjnkeMg37UuUiVPrXyv2Cs5Xks28dtiBUkMxmd5wj73XsSux96Aivis118sT3"],
];

// The refund path, run on mainnet on 9 Oct 2026: refunded inside the window, so the router gets nothing.
const REFUND = [
  ["14:55:54 UTC", "Agent pays 0.05 USDC into the vault", "2j1px41kGNsg7QQvx2pyr9UH75TE4R1Wnfa22MmsTTtzKwccT8fXrZ9w7CY1zr3LftH23y7yBcbU9Tb2FFkj3ZUS"],
  ["14:55:56 UTC", "Relayer records it, 0.005 USDC held", "3P2qbXKx2SfRFN4u922UoVzh2WJmbYqqmZ3nkhX6yPBYkC6jKCYZ2J5q5Unq5bKZQZmPLQydE1bcUdpM7ogwvwkr"],
  ["14:56:14 UTC", "Tool refunds the 0.05 USDC to the agent", "4b1FAR1LUvMUFdfk6FK75UMnZuDBjQQsTuvh9JdCtA7kCdG6ALvK3MVABwtzEzFUuJ2SGgKNgTjbHJ4vzgvhKKuG"],
  ["14:56:27 UTC", "Relayer cancels the commission; the router gets nothing", "44iK8DZtKV1rbbrzYePzmawHufwhrAgp97JcFCAeMYi7K586FL34QCJB3VQEJuSaZr4oi5szqN9qk3CviPwzJp31"],
];

export default async function Demo({ params }: PageProps<"/[lang]/demo">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-5 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Demo: one full cycle on mainnet</h1>
        <p className="mt-2 text-muted">Recorded on 6 Oct 2026 against Solana mainnet. The payment, the hold and the release are real transactions; animated diagrams explain each step. The refund case in the video is a diagram, and the same path also ran for real on mainnet on 9 Oct 2026 (second table). The 10-minute wait is cut; every timestamp on screen is real.</p>
        <video className="mt-6 w-full rounded-xl border border-line bg-black" src="/demo/commish-x402-demo.mp4" poster="/demo/poster.jpg" controls playsInline preload="metadata" />
        <p className="mt-2 text-xs text-muted"><a className="underline" href="/demo/commish-x402-demo.mp4" download>Download MP4</a> (1:17, 1080p, 11 MB)</p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>{["Time", "Step", "Transaction"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {TX.map(([at, what, sig]) => (
                <tr key={sig}>
                  <td className="px-4 py-2.5 whitespace-nowrap">{at}</td>
                  <td className="px-4 py-2.5">{what}</td>
                  <td className="px-4 py-2.5 font-mono text-xs"><a className="underline" href={`https://explorer.solana.com/tx/${sig}`} target="_blank" rel="noreferrer">{sig.slice(0, 8)}…{sig.slice(-5)}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="mt-10 text-lg font-semibold tracking-tight">Refund path, 9 Oct 2026</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>{["Time", "Step", "Transaction"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {REFUND.map(([at, what, sig]) => (
                <tr key={sig}>
                  <td className="px-4 py-2.5 whitespace-nowrap">{at}</td>
                  <td className="px-4 py-2.5">{what}</td>
                  <td className="px-4 py-2.5 font-mono text-xs"><a className="underline" href={`https://explorer.solana.com/tx/${sig}`} target="_blank" rel="noreferrer">{sig.slice(0, 8)}…{sig.slice(-5)}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted">
          Program <a className="underline font-mono" href={`https://explorer.solana.com/address/${PROGRAM_ADDRESS}`} target="_blank" rel="noreferrer">{PROGRAM_ADDRESS}</a> ·{" "}
          <a className="underline" href={`/${lang}/live`}>live ledger</a> · <a className="underline" href={`/${lang}/agent`}>try the 402 endpoint</a> ·{" "}
          <a className="underline" href={REPO_URL} target="_blank" rel="noreferrer">code</a>
        </p>
        <p className="mt-2 text-xs text-muted">All payments so far come from the founder&apos;s own test agent. Outside agents: 0.</p>
      </main>
      <Footer />
    </>
  );
}
