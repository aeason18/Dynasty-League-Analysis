import Link from "next/link";
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
    <div className="mx-auto flex min-h-[75vh] w-full max-w-7xl flex-col items-center justify-center gap-10 px-4 py-16 text-center sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-4">
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">
          Dynasty<span className="text-primary">://</span>Archive
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
