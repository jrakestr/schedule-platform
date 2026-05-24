export const OPTIMIZER_SECTIONS = ["call-center", "drivers"] as const;

export type OptimizerSection = (typeof OPTIMIZER_SECTIONS)[number];

export const OPTIMIZER_SECTION_LABELS: Record<OptimizerSection, string> = {
  "call-center": "Call Center",
  drivers: "Drivers",
};

export function isOptimizerSection(value: unknown): value is OptimizerSection {
  return (
    typeof value === "string" &&
    (OPTIMIZER_SECTIONS as readonly string[]).includes(value)
  );
}
