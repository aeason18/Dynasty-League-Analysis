"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { checkLeagueReady } from "@/lib/actions/onboarding";

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 3 * 60 * 1000;

export function ImportingStatus({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    startedAt.current = Date.now();

    async function poll() {
      const redirectTo = await checkLeagueReady(leagueId);
      if (cancelled) return;
      if (redirectTo) {
        router.push(redirectTo);
        return;
      }
      if (Date.now() - (startedAt.current ?? Date.now()) > TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [leagueId, router]);

  if (timedOut) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-foreground">This is taking longer than expected</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Setup for league {leagueId} is still running in the background. Check back in a few minutes — it&apos;ll be
          ready the next time you enter this same league ID.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm font-medium text-foreground">Setting up your league…</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Pulling your league&apos;s full history from Sleeper — this usually takes under a minute.
      </p>
    </div>
  );
}
