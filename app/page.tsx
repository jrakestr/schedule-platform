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
  // #region agent log
  if (typeof fetch !== "undefined") {
    fetch('http://127.0.0.1:7652/ingest/f98b42a6-0ecb-4542-93cc-9816df326eaf',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8cb33e'},
      body:JSON.stringify({
        sessionId:'8cb33e',
        runId: 'init',
        hypothesisId:'2',
        location:'page.tsx:15',
        message:'loading platform snapshot',
        data:{},
        timestamp: 1779659000000
      })
    }).catch(()=>{});
  }
  // #endregion

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
