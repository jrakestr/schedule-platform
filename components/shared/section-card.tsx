import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  /** Left-edge accent color (hex). Uses pod palette when set. */
  accentColor?: string;
}

export function SectionCard({
  title,
  description,
  toolbar,
  children,
  className,
  accentColor,
  ...rest
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl relative overflow-hidden surface-panel",
        accentColor && "pl-[3px]",
        className,
      )}
      {...rest}
    >
      {accentColor && (
        <div
          className="absolute inset-y-0 left-0 w-[3px] z-20"
          style={{
            background: `linear-gradient(180deg, ${accentColor}, ${accentColor}88)`,
          }}
          aria-hidden
        />
      )}
      <div
        className="absolute inset-0 dot-grid pointer-events-none select-none opacity-30 dark:opacity-15"
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none select-none opacity-50 dark:opacity-30"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--surface-wash) / 0.6) 0%, transparent 55%)",
        }}
        aria-hidden
      />
      <div className="relative z-10 h-full w-full">
        {(title || toolbar) && (
          <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3.5">
            <div className="min-w-0 flex-1 basis-full sm:basis-auto">
              {title && (
                <h2 className="font-semibold text-sm leading-snug tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {toolbar && (
              <div className="flex min-w-0 w-full sm:w-auto max-w-full items-center gap-2 overflow-x-auto">
                {toolbar}
              </div>
            )}
          </header>
        )}
        <div className="p-5">{children}</div>
      </div>
    </section>
  );
}
