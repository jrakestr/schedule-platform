import { z } from "zod";

const durationHmSchema = z
  .string()
  .trim()
  .regex(/^\d{1,2}:\d{2}$/, "Duration must use H:MM or HH:MM format");

export const workLimitationsSchema = z.object({
  maxWorkTime: durationHmSchema,
  maxStretch: z.object({
    enabled: z.boolean(),
    time: durationHmSchema,
  }),
  breaks: z.object({
    enabled: z.boolean(),
    every: durationHmSchema,
    length: durationHmSchema,
  }),
});

export type WorkLimitations = z.infer<typeof workLimitationsSchema>;

export const SHIFT_MAX_COUNT_LIMIT = 200;
export const CUBICLE_CAP_LIMIT = 200;

export const shiftConstraintSchema = z.object({
  enabled: z.boolean(),
  maxCount: z
    .number()
    .int()
    .nonnegative("Maximum count cannot be negative")
    .max(SHIFT_MAX_COUNT_LIMIT, `Maximum count cannot exceed ${SHIFT_MAX_COUNT_LIMIT}`),
});

export const optimizerConstraintsSchema = z.object({
  name: z.string().trim().min(3, "Optimization run name must be at least 3 characters").max(120, "Optimization run name is too long"),
  notes: z
    .union([z.string().trim().max(500), z.null()])
    .optional()
    .transform((val) => val ?? null),
  cubicleCap: z
    .number()
    .int()
    .positive("Cubicle capacity must be a positive number")
    .max(CUBICLE_CAP_LIMIT, `Cubicle capacity cannot exceed ${CUBICLE_CAP_LIMIT}`)
    .default(34),
  shifts: z.object({
    sixHour: shiftConstraintSchema,
    eightHour: shiftConstraintSchema,
    tenHour: shiftConstraintSchema,
    twelveHour: shiftConstraintSchema,
    splitShift: shiftConstraintSchema,
  }),
  workLimitations: workLimitationsSchema.optional(),
});

export type ShiftConstraint = z.infer<typeof shiftConstraintSchema>;
export type OptimizerConstraints = z.infer<typeof optimizerConstraintsSchema>;
