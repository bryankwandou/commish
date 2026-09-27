import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getDictionary, hasLocale } from "@/i18n";
import { ERRORS } from "@/lib/commish/program";
import { PROGRAM_ADDRESS, REPO_URL } from "@/lib/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/docs">): Promise<Metadata> {
  const { lang } = await params;
  return hasLocale(lang) ? { title: getDictionary(lang).docs.title } : {};
}

const H = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="mb-4 mt-14 scroll-mt-24 text-2xl font-semibold tracking-tight first:mt-0">
    {children}
  </h2>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="mb-4 leading-relaxed text-muted">{children}</p>;
const C = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-text">{children}</code>;

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs text-muted">
          <tr>{head.map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="px-4 py-2.5 align-top">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Docs({ params }: PageProps<"/[lang]/docs">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang).docs;
  const s = t.sections;
  const toc = Object.entries(s);
  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[200px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            {toc.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-md px-2 py-1.5 text-muted hover:bg-surface-2 hover:text-text">{label}</a>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-[-0.03em]">{t.title}</h1>
          <p className="mb-12 mt-3 text-muted">{t.sub}</p>

          <H id="overview">{s.overview}</H>
          <P>
            Commish is one Solana program written with Pinocchio. A brand creates a campaign that names a commission rate, a refund window and an
            attestor key, and funds the campaign&apos;s USDC vault. The attestor records each paid, referred order; the program reserves the creator&apos;s
            cut in a commission account. After the refund window anyone can release the payout to the payee. Before that, the payee can sell the
            commission to a buyer for an agreed price.
          </P>
          <Table
            head={["", ""]}
            rows={[
              ["Program", <C key="p">{PROGRAM_ADDRESS}</C>],
              ["Token", <span key="t">USDC <C>EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v</C></span>],
              ["Source", <a key="s" href={REPO_URL} className="text-paid hover:underline">{REPO_URL.replace("https://", "")}</a>],
              ["Binary", "9,296 bytes, SBPF v0, built with build-std and panic_immediate_abort"],
            ]}
          />

          <H id="accounts">{s.accounts}</H>
          <Table
            head={["Account", "Address", "Size", "Holds"]}
            rows={[
              ["Campaign", <C key="a">[&quot;campaign&quot;, brand, id_le_u64]</C>, "176", "brand, attestor, mint, vault, id, hold, reserved, paid, bps"],
              ["Commission", <C key="b">[&quot;commission&quot;, campaign, order_hash]</C>, "184", "campaign, creator, payee, rent_payer, order_hash, amount, release_at, sold flag"],
              ["Vault", "ATA(campaign, USDC)", "165", "The campaign's budget. Owned by the campaign PDA."],
            ]}
          />
          <P>
            Records are <C>#[repr(C)]</C>, little-endian, 8-byte aligned. Byte 0 is a tag (1 campaign, 2 commission), byte 1 the version, byte 2 the
            bump. A commission account is closed when it is paid or cancelled, and its rent returns to <C>rent_payer</C>.
          </P>

          <H id="instructions">{s.instructions}</H>
          <P>
            Instruction data is an 8-byte header with the tag in byte 0, followed by the arguments as a <C>#[repr(C)]</C> struct. Bumps and the rent
            for new accounts are passed by the client; the runtime rejects a wrong bump and any new account below the rent-exempt minimum.
          </P>
          <Table
            head={["Tag", "Instruction", "Signers", "Accounts", "Arguments"]}
            rows={[
              ["0", "create_campaign", "brand", "brand, campaign, vault, mint, system", "id, hold, bps, bump, lamports, attestor"],
              ["1", "record_sale", "attestor, payer", "attestor, payer, campaign, vault, commission, system", "order_hash, order_amount, creator, lamports, bump"],
              ["2", "cancel", "attestor", "attestor, campaign, commission, rent_payer", "none, only before release_at"],
              ["3", "release", "none", "campaign, vault, commission, payee_token, rent_payer, token_program", "none, only after release_at"],
              ["4", "withdraw", "brand", "brand, campaign, vault, dest, token_program", "amount ≤ vault − reserved"],
              ["5", "sell", "payee, buyer", "payee, buyer, campaign, commission, buyer_token, payee_token, token_program", "price, 0 < price ≤ amount, before release_at"],
            ]}
          />

          <H id="errors">{s.errors}</H>
          <Table head={["Code", "Meaning"]} rows={Object.entries(ERRORS).map(([k, v]) => [<C key={k}>{k}</C>, v])} />

          <H id="integrate">{s.integrate}</H>
          <ol className="mb-6 list-decimal space-y-2 pl-5 text-muted">
            <li>Create a campaign in the brand console and choose who records sales: the brand wallet, or a key held by your shop server.</li>
            <li>Creators share your product links with <C>?ref=&lt;their wallet&gt;</C>. Store the ref with the order at checkout.</li>
            <li>When the order is paid, compute <C>orderHash(campaign, orderId, key)</C> with a key only the attestor holds and send <C>record_sale</C> signed by the attestor.</li>
            <li>If the order is refunded inside the window, send <C>cancel</C>. After the window, anyone can send <C>release</C>.</li>
          </ol>
          <P>
            The client in <C>web/src/lib/commish/program.ts</C> builds every instruction and derives every address. It depends only on
            <C>@solana/kit</C> primitives, so it runs in a browser, a server route or a worker.
          </P>

          <H id="security">{s.security}</H>
          <ul className="mb-6 list-disc space-y-2 pl-5 text-muted">
            <li>The attestor is trusted to report real sales. The program cannot tell whether an off-chain order happened; it removes the brand&apos;s ability to delay or claw back a commission once recorded.</li>
            <li>Funds leave the vault only through <C>release</C> (to the payee&apos;s token account, after the window) and <C>withdraw</C> (the unreserved part, to the brand).</li>
            <li>Only the legacy SPL Token program is accepted, and every token account is checked for the campaign&apos;s mint.</li>
            <li>A commission address that already holds lamports makes <C>record_sale</C> fail for that order. Derive order hashes with a key only the attestor holds (<C>orderHash(campaign, orderId, key)</C>, HMAC-SHA256) so nobody can predict the next address and block it; the brand console does this with a key derived from the attestor wallet.</li>
            <li>An order can be recorded again after its commission is paid or cancelled, because the account is closed. Only the attestor can record, so this is the attestor&apos;s responsibility.</li>
            <li>The program is not audited. It is covered by 26 end-to-end tests that run against the compiled binary, most of them attacks that must fail.</li>
          </ul>
        </article>
      </main>
      <Footer />
    </>
  );
}
