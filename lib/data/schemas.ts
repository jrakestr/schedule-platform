import { z } from "zod";

export const shiftConstraintSchema = z.object({
  enabled: z.boolean(),
  maxCount: z.number().int().nonnegative("Maximum count cannot be negative"),
}); // Removed .strict() to allow safe client/telemetry metadata stripping

export const optimizerConstraintsSchema = z.object({
  name: z.string().trim().min(3, "Optimization run name must be at least 3 characters"),
  // Normalize empty strings to null for consistent DB state
  notes: z.string().trim().max(500).optional().nullable().transform(val => val || null),
  cubicleCap: z.number().int().positive("Cubicle capacity must be a positive number"),
  shifts: z.object({
    sixHour: shiftConstraintSchema,
    eightHour: shiftConstraintSchema,
    tenHour: shiftConstraintSchema,
    twelveHour: shiftConstraintSchema,
  }),
}); // Removed .strict() for pipeline resiliency

export type ShiftConstraint = z.infer<typeof shiftConstraintSchema>;
export type OptimizerConstraints = z.infer<typeof optimizerConstraintsSchema>;
