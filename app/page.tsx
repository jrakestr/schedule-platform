import { Suspense } from "react";
import { getLatestSnapshot, listOptimizations } from "@/lib/data/snapshot";
import { PlatformShell } from "@/components/platform-shell";
import { Skeleton } from "@/components/ui/skeleton";

interface PageProps {
  searchParams: Promise<{ opt_id?: string }>;
}

export default function Page({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlatformLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function PlatformLoader({ searchParams }: { searchParams: Promise<{ opt_id?: string }> }) {
  await searchParams;

  const [baselineSnapshot, optimizations] = await Promise.all([
    getLatestSnapshot(),
    listOptimizations(),
  ]);
  return (
    <PlatformShell
      baselineSnapshot={baselineSnapshot}
      optimizations={optimizations}
    />
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen page-shell">
      <div className="border-b surface-panel">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <Skeleton className="h-6 w-72" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
