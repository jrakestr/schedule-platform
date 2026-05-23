import { Suspense } from "react";
import { getLatestSnapshot, getSnapshotTakenAt } from "@/lib/data/snapshot";
import { PlatformShell } from "@/components/platform-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlatformLoader />
    </Suspense>
  );
}

async function PlatformLoader() {
  const [snapshot, takenAt] = await Promise.all([
    getLatestSnapshot(),
    getSnapshotTakenAt(),
  ]);
  return <PlatformShell snapshot={snapshot} takenAt={takenAt} />;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
