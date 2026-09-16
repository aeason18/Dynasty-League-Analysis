import { Skeleton } from "@/components/ui/skeleton";

/**
 * The player detail page is the slowest route in the app -- it waits on a
 * live call to the dynasty-ppg-api Modal deployment, which can take a few
 * seconds on a cold start. Without this, a click into a player just sits
 * there with no feedback until that call resolves.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-28" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      <Skeleton className="h-24 w-full rounded-2xl lg:max-w-xs" />

      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
