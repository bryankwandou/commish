import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAddress } from "@solana/kit";
import { CampaignView } from "@/components/campaign-view";

export async function generateMetadata({ params }: PageProps<"/[lang]/campaign/[address]">): Promise<Metadata> {
  const { address } = await params;
  return { title: `Campaign ${address.slice(0, 6)}…` };
}

export default async function Page({ params }: PageProps<"/[lang]/campaign/[address]">) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  return <CampaignView address={address} />;
}
