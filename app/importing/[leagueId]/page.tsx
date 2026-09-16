import { ImportingStatus } from "@/components/importing-status";

export const metadata = { title: "Setting up your league" };

export default async function ImportingPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl flex-col items-center justify-center gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <ImportingStatus leagueId={leagueId} />
    </div>
  );
}
