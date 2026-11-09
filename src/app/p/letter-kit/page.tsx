import { notFound } from "next/navigation";
import { ProposalKit } from "./proposal-kit";

export const metadata = {
  title: "Proposal letter kit",
  robots: { index: false, follow: false },
};

export default async function ProposalLetterKitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;
  const expected = process.env.PROPOSAL_KIT_KEY;

  if (!expected || key !== expected) {
    notFound();
  }

  return <ProposalKit />;
}
