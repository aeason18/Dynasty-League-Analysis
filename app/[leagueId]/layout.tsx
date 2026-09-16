import { notFound } from "next/navigation";
import { getCurrentLeague, resolveLeagueGroupId } from "@/lib/queries/leagues";
import { SeasonBadgeSetter } from "@/components/season-badge-setter";

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

  const current = await getCurrentLeague(leagueGroupId);

  return (
    <>
      <SeasonBadgeSetter season={current?.season ?? null} />
      {children}
    </>
  );
}
