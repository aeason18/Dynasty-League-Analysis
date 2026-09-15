import { notFound } from "next/navigation";
import { resolveLeagueGroupId } from "@/lib/queries/leagues";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const leagueGroupId = await resolveLeagueGroupId(leagueId);
  if (!leagueGroupId) notFound();

  return children;
}
