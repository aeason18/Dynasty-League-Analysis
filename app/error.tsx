"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">Something went wrong loading this data</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while querying the archive."}
        </p>
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  );
}
