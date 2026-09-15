import { ImportingStatus } from "@/components/importing-status";

export const metadata = { title: "Setting up your league" };

export default async function ImportingPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16">
      <ImportingStatus leagueId={leagueId} />
    </div>
  );
}
