/** Stakeholder-facing definitions for WFM metrics (Validation, Coverage, Optimizer). */

export const WFM_DATA_SOURCE =
  "Call volume and AHT are built from output/call_segments_cleaned.csv (May 1–20 call stats). Forecast cells use the mean offered calls per weekday × 30-minute interval across full ISO weeks in that file.";

export const WFM_ANSWERED_RULE =
  "Answered = non-blank agent_name. Abandoned = blank agent_name. contact_disposition is not used for this split.";

export const WFM_AHT =
  "Average handle time uses handled calls only: talk_duration_seconds + work_duration_seconds, averaged per queue and 30-minute interval. Abandoned calls are excluded from AHT.";

export const WFM_OFFERED =
  "Offered calls = all rows in the forecast cell (answered + abandoned). Used as Erlang arrival rate and as the Calls column in Validation.";

export const WFM_ABANDONED =
  "Abandoned calls = rows with blank agent_name in the same interval. Shown for context; Erlang sizing still uses total offered volume.";

export const WFM_ERLANG_REQUIRED =
  "Required (Req) = minimum CSA agents on phones from Erlang C for forecast offered × AHT in that hour. Targets: 80% answered within 20 seconds, 85% max occupancy, 30% shrinkage. Produced by scripts/forecast_and_size.py → output/erlang_staffing_by_interval.csv.";

export const WFM_PROPOSED =
  "Proposed (Prop) = count of scheduled CSAs in Voice for ≥15 minutes in that hour (shift day-structure). CSA Leads count at the lead discount set in the header slider. Not a per-agent call count.";

export const WFM_LEGACY =
  "Current (Curr) = legacy roster from analytics.legacy_roster, mapped to the same Voice-interval rules for comparison.";

export const WFM_GAP =
  "Gap = Proposed − Required. Negative = understaffed vs Erlang for that hour. The roster optimizer does not close weekday Erlang gaps (36-CSA pool / 34-cubicle cap); weekend floors target ~50% of Erlang need.";

export const WFM_PLAN_DELTA =
  "Plan Δ compares Proposed vs Current headcount in that hour (+CSA / −CSA / Match). It does not measure service level.";

export const WFM_GAP_HOURS =
  "Gap hours = sum of (Required − Proposed) across intervals where Required exceeds Proposed. Interval-level understaffing, not agent-hours worked.";

export const WFM_VOLUME_MATCHED =
  "Volume-matched share = fraction of daily offered calls that fall in intervals where CSA Voice supply is scheduled. Shape alignment metric; does not prove Erlang service level.";

export const WFM_OPTIMIZER_OBJECTIVE =
  "The roster optimizer maximizes CSA Voice supply in intervals weighted by offered × AHT (RideChoice + ADA + ETA), plus scheduler presence patterns. It does not assign a call count to each agent.";

export const WFM_NO_PER_AGENT_CALLS =
  "No per-agent call totals are modeled. Workload is interval-level: offered × AHT → Erlang agents needed vs Voice headcount scheduled.";
