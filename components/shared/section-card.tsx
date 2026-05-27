import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  /** Override default padding on the content area. */
  contentClassName?: string;
  /** Left-edge accent color (hex). Uses pod palette when set. */
  accentColor?: string;
}

export function SectionCard({
  title,
  description,
  toolbar,
  children,
  className,
  contentClassName,
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
              <div className="flex min-w-0 w-full max-w-full basis-full items-center gap-2 overflow-x-auto">
                {toolbar}
              </div>
            )}
          </header>
        )}
        <div className={cn("p-5", contentClassName)}>{children}</div>
      </div>
    </section>
  );
}
