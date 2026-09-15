import Link from "next/link";
import { Trophy } from "lucide-react";
import { getCurrentLeague, resolveLeagueGroupId } from "@/lib/queries/leagues";
import { OnboardingForm } from "@/components/onboarding-form";

export const revalidate = 300;

async function getExampleLeague() {
  const seedLeagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!seedLeagueId) return null;
  const leagueGroupId = await resolveLeagueGroupId(seedLeagueId);
  if (!leagueGroupId) return null;
  const current = await getCurrentLeague(leagueGroupId);
  if (!current) return null;
  return { href: `/${current.league_id}`, name: current.name };
}

export default async function OnboardingPage() {
  const example = await getExampleLeague();

  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center gap-10 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Trophy className="h-7 w-7" strokeWidth={2.25} />
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Fantasy League Archive
        </h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Your league. Your history. Your analytics. Enter your Sleeper league ID to pull up every season, record,
          and trade — computed from real Sleeper data.
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3">
        <OnboardingForm />
        {example && (
          <p className="text-xs text-muted-foreground">
            Don&apos;t have a league ID handy? Take a look at{" "}
            <Link href={example.href} className="font-medium text-primary hover:text-primary/80">
              {example.name}
            </Link>
            , a real dynasty league already set up here.
          </p>
        )}
      </div>
    </div>
  );
}
