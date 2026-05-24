// Mirrors the shape produced by scripts/build_platform_data.py and stored in
// analytics.platform_snapshots.payload. Keep this type strict to catch
// pipeline regressions at compile time when the Python script evolves.

export type DOW = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const DOW_LIST: readonly DOW[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export type FunctionName =
  | "Combined"
  | "Reservations"
  | "ETA"
  | "Cancellations"
  | "Dispatch";

export const CSA_FUNCTIONS: readonly FunctionName[] = [
  "Combined",
  "Reservations",
  "ETA",
  "Cancellations",
] as const;

export interface SnapshotMeta {
  source: string;
  source_rows: number;
  forecast_weeks: string[];
  dow: DOW[];
  intervals: string[];
  hours: string[];
  lead_on_work_default: number;
  total_bodies: number;
  role_counts: {
    CSA: number;
    NDS: number;
    SDS: number;
    Supervisor: number;
  };
  phones_open: string;
  cubicle_cap: number;
  template_delta_note?: string;
}

export interface Cubicles {
  cap: number;
  occupancy_by_day_hour: Record<DOW, number[]>;
}

export interface RoleSummary {
  total: number;
  leads: number;
  line: number;
  primary_work: string;
}

export interface ShiftSegment {
  start_min: number;
  duration_min: number;
  kind: "Voice" | "Break" | "Lunch";
}

export interface ShiftCatalogEntry {
  shift_id: string;
  label: string;
  shift_class: string;
  start_minute: number;
  start_clock: string;
  end_clock: string;
  gross_minutes: number;
  productive_minutes: number;
  days: string;
  rationale: string;
  segments: ShiftSegment[];
  coverage_mask: number[];
}

export interface Assignment {
  weekday_idx: number;
  weekday: string;
  shift_type: string;
  hours: string;
}

export interface Agent {
  id: string;
  /** Display name when mapped in the roster snapshot; falls back to id in UI. */
  name?: string;
  role: "CSA" | "NDS" | "SDS" | "Supervisor";
  position: "Line" | "Lead" | "Supervisor";
  team?: string;
  shift_id: string;
  shift_name?: string;
  shift_class: string;
  start_clock: string;
  end_clock: string;
  gross_hours?: number;
  productive_hours?: number;
  voice_hours?: number;
  effective_hours_per_week?: number;
  on_work_pct?: number;
  off_pair?: string;
  works_days: DOW[];
  structure: string;
  cubicle_by_day?: Partial<Record<DOW, string>>;
  assignments?: Assignment[];
}

export interface Pod {
  type: string;
  supervisor_id: string;
  lead_id: string;
  members: string[];
  description?: string;
  coverage_start?: string;
  coverage_end?: string;
  coverage_window?: string;
}

export interface VolumeWeekly {
  offered: number;
  required_agent_intervals?: number;
  mean_aht_seconds?: number;
}

export interface Volume {
  offered_per_interval: Record<FunctionName, Record<DOW, number[]>>;
  required_on_phones: Record<FunctionName, Record<DOW, number[]>>;
  aht_seconds: Record<FunctionName, Record<DOW, number[]>>;
  weekly: Record<FunctionName, VolumeWeekly>;
}

export interface SupplyCurves {
  csa_effective: Record<DOW, number[]>;
  csa_raw: Record<DOW, number[]>;
  schedulers: Record<DOW, number[]>;
}

export interface CoverageHourly {
  required: number[];
  supplied: number[];
  gap: number[];
}

export interface Supervisor {
  id: string;
  assignments: Assignment[];
}

export interface SupervisorSchedule {
  status: string;
  supervisors: Supervisor[];
  hourly_coverage: number[][];
  min_coverage: number;
  single_cover_hours: number;
  overlap_hours: number;
  total_scheduled_hours: number;
  required_hours: number;
}

export interface Snapshot {
  meta: SnapshotMeta;
  cubicles: Cubicles;
  roles: Record<string, RoleSummary>;
  shift_catalog: ShiftCatalogEntry[];
  agents: Agent[];
  pods: Record<string, Pod>;
  volume: Volume;
  supply: SupplyCurves;
  coverage_hourly: Record<FunctionName, Record<DOW, CoverageHourly>>;
  supervisor_schedule: SupervisorSchedule;
}

export interface SnapshotRow {
  payload: Snapshot;
  taken_at: string;
}
