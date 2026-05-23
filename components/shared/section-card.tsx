import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  bgImage?: string;
  bgImageOpacity?: number;
}

export function SectionCard({
  title,
  description,
  toolbar,
  children,
  className,
  bgImage,
  bgImageOpacity = 0.06,
  ...rest
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm relative overflow-hidden",
        className,
      )}
      {...rest}
    >
      {bgImage && (
        <div
          className="absolute inset-0 bg-no-repeat bg-cover bg-center pointer-events-none select-none mix-blend-multiply dark:mix-blend-screen"
          style={{
            backgroundImage: `url('${bgImage}')`,
            opacity: bgImageOpacity,
          }}
        />
      )}
      <div className="relative z-10 h-full w-full">
        {(title || toolbar) && (
          <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3">
            <div>
              {title && (
                <h2 className="font-semibold text-sm leading-snug">{title}</h2>
              )}
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
          </header>
        )}
        <div className="p-5">{children}</div>
      </div>
    </section>
  );
}
