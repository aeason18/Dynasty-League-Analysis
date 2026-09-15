"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { startOnboarding } from "@/lib/actions/onboarding";

export function OnboardingForm() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await startOnboarding(leagueId);
      if (result.status === "invalid") {
        setError(result.error);
      } else if (result.status === "known") {
        router.push(result.redirectTo);
      } else {
        router.push(`/importing/${leagueId.trim()}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input
          value={leagueId}
          onChange={(e) => setLeagueId(e.target.value)}
          placeholder="Your Sleeper league ID"
          inputMode="numeric"
          className="bg-card h-11 text-base"
          disabled={isPending}
        />
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      </div>
      <Button type="submit" size="lg" disabled={isPending || !leagueId.trim()} className="gap-1.5">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        View My League
      </Button>
    </form>
  );
}
