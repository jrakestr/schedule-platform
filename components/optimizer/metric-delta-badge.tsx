import { cn } from "@/lib/utils";

interface MetricDeltaBadgeProps {
  delta: number;
  /** When true, a negative delta is favorable (e.g. cost reduction). */
  invertPolarity?: boolean;
  /** Display decimals; defaults to integer rounding (0). */
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

/**
 * Formats a number with a mandatory sign (+ or -) and specified decimals.
 * Leverages native Intl.NumberFormat for clean, accurate rounding and localizing.
 */
function formatSigned(value: number, decimals: number): { formatted: string; isZero: boolean } {
  // Leverage Intl.NumberFormat to round and format in a single pass
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const formattedValue = formatter.format(value);
  
  // A value is strictly zero if its formatted string contains only '0', '.', or ','
  const isZero = /^0([.,]0+)?$/.test(formattedValue);
  if (isZero) {
    return { formatted: "0", isZero: true };
  }

  // Ensure positive numbers are explicitly prepended with a '+' sign
  const signedFormatted = value > 0 ? `+${formattedValue}` : formattedValue;
  return { formatted: signedFormatted, isZero: false };
}

export function MetricDeltaBadge({
  delta,
  invertPolarity = false,
  decimals = 0,
  suffix = "",
  prefix = "",
  className,
}: MetricDeltaBadgeProps) {
  const { formatted, isZero } = formatSigned(delta, decimals);

  const favorable = invertPolarity ? delta < 0 : delta > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        isZero && "bg-muted text-muted-foreground",
        // Favorable colors (e.g., Higher coverage or lower cost)
        !isZero && favorable && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
        // Unfavorable colors (e.g., Lower coverage or higher cost) - switched to standard red/rose spectrum
        !isZero && !favorable && "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
        className,
      )}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
