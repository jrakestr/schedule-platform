import { Truck } from "lucide-react";

export function DriversPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-10 max-w-md w-full">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          <Truck className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          Driver scheduling
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Not configured. This section will hold driver roster and shift tools.
        </p>
      </div>
    </div>
  );
}
