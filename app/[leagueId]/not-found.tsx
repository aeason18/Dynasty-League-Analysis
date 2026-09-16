import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function LeagueNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <EmptyState
        icon={SearchX}
        title="We don't have that league"
        description="Either the Sleeper league ID is wrong, or it hasn't been added yet — head back and enter it to get it set up."
      />
      <Button render={<Link href="/">Try another league ID</Link>} />
    </div>
  );
}
