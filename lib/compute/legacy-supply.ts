import type { DOW } from "@/lib/data/types";

// =============================================================================
// Legacy Current Schedule Database (All 53 personnel mapped & formatted)
// =============================================================================

export interface LegacyMember {
  name: string;
  role: "Spanish CSR" | "SDS" | "Next Day" | "Supervisor";
  schedule: Record<DOW, string>;
}

export const LEGACY_ROSTER: LegacyMember[] = [
  // Supervisors (6 total)
  {
    name: "Supervisor 1",
    role: "Supervisor",
    schedule: {
      Mon: "07:00-16:00",
      Tue: "07:00-16:00",
      Wed: "07:00-16:00",
      Thu: "07:00-16:00",
      Fri: "07:00-16:00",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Supervisor 2",
    role: "Supervisor",
    schedule: {
      Mon: "12:00-21:00",
      Tue: "12:00-21:00",
      Wed: "OFF",
      Thu: "OFF",
      Fri: "12:00-21:00",
      Sat: "12:00-21:00",
      Sun: "12:00-21:00",
    },
  },
  {
    name: "Supervisor 3",
    role: "Supervisor",
    schedule: {
      Mon: "OFF",
      Tue: "03:30-12:30",
      Wed: "03:30-12:30",
      Thu: "03:30-12:30",
      Fri: "03:30-12:30",
      Sat: "03:30-12:30",
      Sun: "OFF",
    },
  },
  {
    name: "Supervisor 4",
    role: "Supervisor",
    schedule: {
      Mon: "04:00-14:00",
      Tue: "04:00-14:00",
      Wed: "04:00-14:00",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "04:00-14:00",
    },
  },
  {
    name: "Supervisor 5",
    role: "Supervisor",
    schedule: {
      Mon: "18:00-04:00",
      Tue: "OFF",
      Wed: "12:00-22:00",
      Thu: "12:00-22:00",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "18:00-04:00",
    },
  },
  {
    name: "Supervisor 6",
    role: "Supervisor",
    schedule: {
      Mon: "OFF",
      Tue: "21:00-06:00",
      Wed: "21:00-06:00",
      Thu: "21:00-06:00",
      Fri: "21:00-06:00",
      Sat: "21:00-06:00",
      Sun: "OFF",
    },
  },
  // Spanish CSR Agents (35 total)
  {
    name: "Amara Baker",
    role: "Spanish CSR",
    schedule: {
      Mon: "04:00-12:30",
      Tue: "04:00-12:30",
      Wed: "04:00-12:30",
      Thu: "04:00-12:30",
      Fri: "04:00-12:30",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Cheryl Bolden",
    role: "Spanish CSR",
    schedule: {
      Mon: "07:30-16:00",
      Tue: "07:30-16:00",
      Wed: "07:30-16:00",
      Thu: "07:30-16:00",
      Fri: "07:30-16:00",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Angela Gibson",
    role: "Spanish CSR",
    schedule: {
      Mon: "07:30-16:00",
      Tue: "07:30-16:00",
      Wed: "07:30-16:00",
      Thu: "07:30-16:00",
      Fri: "07:30-16:00",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Diane Rodriguez",
    role: "Spanish CSR",
    schedule: {
      Mon: "07:30-16:00",
      Tue: "07:30-16:00",
      Wed: "07:30-16:00",
      Thu: "07:30-16:00",
      Fri: "07:30-16:00",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Makayla Young",
    role: "Spanish CSR",
    schedule: {
      Mon: "06:30-14:30",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "06:30-14:30",
      Fri: "06:30-14:30",
      Sat: "06:30-14:30",
      Sun: "06:30-14:30",
    },
  },
  {
    name: "Mario Zelaya",
    role: "Spanish CSR",
    schedule: {
      Mon: "09:00-17:30",
      Tue: "09:00-17:30",
      Wed: "09:00-17:30",
      Thu: "09:00-17:30",
      Fri: "09:00-17:30",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Sekita Williams",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "04:30-13:00",
      Wed: "04:30-13:00",
      Thu: "04:30-13:00",
      Fri: "04:30-13:00",
      Sat: "04:30-13:00",
      Sun: "OFF",
    },
  },
  {
    name: "Tasha Arnold",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "OFF",
      Wed: "17:30-04:30",
      Thu: "17:30-04:30",
      Fri: "17:30-04:30",
      Sat: "17:30-04:30",
      Sun: "OFF",
    },
  },
  {
    name: "Lydia Cruz",
    role: "Spanish CSR",
    schedule: {
      Mon: "09:00-17:30",
      Tue: "09:00-17:30",
      Wed: "09:00-17:30",
      Thu: "09:00-17:30",
      Fri: "09:00-17:30",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Essence Mars",
    role: "Spanish CSR",
    schedule: {
      Mon: "04:00-12:30",
      Tue: "04:00-12:30",
      Wed: "04:00-12:30",
      Thu: "04:00-12:30",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "04:00-12:30",
    },
  },
  {
    name: "Isolde Tristan",
    role: "Spanish CSR",
    schedule: {
      Mon: "07:30-16:00",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "07:30-16:00",
      Fri: "07:30-16:00",
      Sat: "07:30-16:00",
      Sun: "07:30-16:00",
    },
  },
  {
    name: "Monique Ezell",
    role: "Spanish CSR",
    schedule: {
      Mon: "09:00-17:30",
      Tue: "09:00-17:30",
      Wed: "09:00-17:30",
      Thu: "09:00-17:30",
      Fri: "09:00-17:30",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Julia Mailland",
    role: "Spanish CSR",
    schedule: {
      Mon: "17:30-04:30",
      Tue: "17:30-04:30",
      Wed: "17:30-04:30",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "17:30-04:30",
    },
  },
  {
    name: "Laura Lopez",
    role: "Spanish CSR",
    schedule: {
      Mon: "13:00-21:30",
      Tue: "13:00-21:30",
      Wed: "13:00-21:30",
      Thu: "13:00-21:30",
      Fri: "13:00-21:30",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Francisco Perez",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "OFF",
      Wed: "05:00-13:30",
      Thu: "05:00-13:30",
      Fri: "05:00-13:30",
      Sat: "05:00-13:30",
      Sun: "05:00-13:30",
    },
  },
  {
    name: "Doreen Villegas",
    role: "Spanish CSR",
    schedule: {
      Mon: "09:30-18:00",
      Tue: "09:30-18:00",
      Wed: "09:30-18:00",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "09:30-18:00",
      Sun: "09:30-18:00",
    },
  },
  {
    name: "Nubia De Leon Flores",
    role: "Spanish CSR",
    schedule: {
      Mon: "07:00-15:30",
      Tue: "07:00-15:30",
      Wed: "OFF",
      Thu: "07:00-15:30",
      Fri: "07:00-15:30",
      Sat: "OFF",
      Sun: "07:00-15:30",
    },
  },
  {
    name: "Onesimo Figueroa",
    role: "Spanish CSR",
    schedule: {
      Mon: "03:30-12:00",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "03:30-12:00",
      Fri: "03:30-12:00",
      Sat: "03:30-12:00",
      Sun: "03:30-12:00",
    },
  },
  {
    name: "David Opel",
    role: "Spanish CSR",
    schedule: {
      Mon: "11:00-19:30",
      Tue: "11:00-19:30",
      Wed: "11:00-19:30",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "11:00-19:30",
      Sun: "11:00-19:30",
    },
  },
  {
    name: "Dante Franklin",
    role: "Spanish CSR",
    schedule: {
      Mon: "09:00-17:30",
      Tue: "09:00-17:30",
      Wed: "09:00-17:30",
      Thu: "09:00-17:30",
      Fri: "OFF",
      Sat: "09:00-17:30",
      Sun: "OFF",
    },
  },
  {
    name: "Nancy Santoyo",
    role: "Spanish CSR",
    schedule: {
      Mon: "11:00-19:30",
      Tue: "11:00-19:30",
      Wed: "11:00-19:30",
      Thu: "11:00-19:30",
      Sat: "11:00-19:30",
      Sun: "OFF",
      Fri: "OFF",
    },
  },
  {
    name: "Maureen Warren",
    role: "Spanish CSR",
    schedule: {
      Mon: "14:00-22:30",
      Tue: "11:00-19:30",
      Wed: "OFF",
      Thu: "OFF",
      Fri: "14:00-22:30",
      Sat: "14:00-22:30",
      Sun: "14:00-22:30",
    },
  },
  {
    name: "Dominique Snyder",
    role: "Spanish CSR",
    schedule: {
      Mon: "11:00-19:30",
      Tue: "11:00-19:30",
      Wed: "OFF",
      Thu: "11:00-19:30",
      Fri: "11:00-19:30",
      Sat: "OFF",
      Sun: "11:00-19:30",
    },
  },
  {
    name: "Erica Sanchez",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Demetria Weeks",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "OFF",
      Wed: "11:00-19:30",
      Thu: "11:00-19:30",
      Fri: "11:00-19:30",
      Sat: "11:00-19:30",
      Sun: "11:00-19:30",
    },
  },
  {
    name: "Andrew Bernacke",
    role: "Spanish CSR",
    schedule: {
      Mon: "13:00-21:30",
      Tue: "13:00-21:30",
      Wed: "13:00-21:30",
      Thu: "13:00-21:30",
      Fri: "13:00-21:30",
      Sat: "OFF",
      Sun: "13:00-21:30",
    },
  },
  {
    name: "Hailey Hutchison",
    role: "Spanish CSR",
    schedule: {
      Mon: "11:00-19:30",
      Tue: "11:00-19:30",
      Wed: "11:00-19:30",
      Thu: "OFF",
      Fri: "11:00-19:30",
      Sat: "OFF",
      Sun: "11:00-19:30",
    },
  },
  {
    name: "Mitzy Ramirez",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "22:00-06:30",
      Wed: "22:00-06:30",
      Thu: "22:00-06:30",
      Fri: "22:00-06:30",
      Sat: "22:00-06:30",
      Sun: "OFF",
    },
  },
  {
    name: "Dalit Porter",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Kim Murphy",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Abraham Bermudez",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Michael Key",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  {
    name: "Cynthia Rodriguez",
    role: "Spanish CSR",
    schedule: {
      Mon: "OFF",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "OFF",
      Fri: "OFF",
      Sat: "OFF",
      Sun: "OFF",
    },
  },
  // SDS Agents (8 total)
  {
    name: "Adam Nogle",
    role: "SDS",
    schedule: {
      Sun: "13:00-22:00",
      Mon: "14:00-22:30",
      Tue: "14:00-22:30",
      Wed: "14:00-22:30",
      Thu: "14:00-22:30",
      Fri: "OFF",
      Sat: "OFF",
    },
  },
  {
    name: "Kevin Matthews",
    role: "SDS",
    schedule: {
      Sun: "OFF",
      Mon: "OFF",
      Tue: "12:00-20:30",
      Wed: "12:00-20:30",
      Thu: "12:00-20:30",
      Fri: "13:00-22:00",
      Sat: "13:00-22:00",
    },
  },
  {
    name: "Evita Williams",
    role: "SDS",
    schedule: {
      Sun: "OFF",
      Mon: "OFF",
      Tue: "03:30-12:00",
      Wed: "03:30-12:00",
      Thu: "03:30-12:00",
      Fri: "03:30-12:00",
      Sat: "03:30-12:30",
    },
  },
  {
    name: "Matthew Williams",
    role: "SDS",
    schedule: {
      Sun: "OFF",
      Mon: "12:00-21:00",
      Tue: "12:00-21:00",
      Wed: "12:00-21:00",
      Thu: "12:00-21:00",
      Fri: "12:00-21:00",
      Sat: "OFF",
    },
  },
  {
    name: "Jay Liles",
    role: "SDS",
    schedule: {
      Sun: "03:30-12:00",
      Mon: "03:30-12:30",
      Tue: "03:30-12:30",
      Wed: "03:30-12:30",
      Thu: "03:30-12:30",
      Fri: "OFF",
      Sat: "OFF",
    },
  },
  {
    name: "Daisy Fernandez",
    role: "SDS",
    schedule: {
      Sun: "OFF",
      Mon: "09:00-17:30",
      Tue: "09:00-17:30",
      Wed: "09:00-17:30",
      Thu: "09:00-17:30",
      Fri: "09:00-17:30",
      Sat: "OFF",
    },
  },
  {
    name: "SDS Agent 7 (Unnamed)",
    role: "SDS",
    schedule: {
      Sun: "04:30-13:00",
      Mon: "05:30-14:00",
      Tue: "05:30-14:00",
      Wed: "OFF",
      Thu: "OFF",
      Fri: "05:30-14:00",
      Sat: "04:30-13:00",
    },
  },
  {
    name: "SDS Agent 8 (Unnamed)",
    role: "SDS",
    schedule: {
      Sun: "OFF",
      Mon: "09:30-18:00",
      Tue: "09:30-18:00",
      Wed: "09:30-18:00",
      Thu: "09:30-18:00",
      Fri: "09:30-18:00",
      Sat: "OFF",
    },
  },
  // Next Day Agents (4 total)
  {
    name: "Robert Fisher",
    role: "Next Day",
    schedule: {
      Sun: "14:30-23:00",
      Mon: "14:30-23:00",
      Tue: "14:30-23:00",
      Wed: "14:30-23:00",
      Thu: "14:30-23:00",
      Fri: "OFF",
      Sat: "OFF",
    },
  },
  {
    name: "Kirsten Nicholson",
    role: "Next Day",
    schedule: {
      Sun: "05:30-14:00",
      Mon: "05:30-14:00",
      Tue: "OFF",
      Wed: "OFF",
      Thu: "05:30-14:00",
      Fri: "05:30-14:00",
      Sat: "05:30-14:00",
    },
  },
  {
    name: "Ilsy Wright",
    role: "Next Day",
    schedule: {
      Sun: "OFF",
      Mon: "OFF",
      Tue: "12:00-20:30",
      Wed: "12:00-20:30",
      Thu: "12:00-20:30",
      Fri: "12:00-20:30",
      Sat: "12:00-20:30",
    },
  },
  {
    name: "Next Day Agent 4 (Unnamed)",
    role: "Next Day",
    schedule: {
      Sun: "11:00-19:30",
      Mon: "11:00-19:30",
      Tue: "11:00-19:30",
      Wed: "11:00-19:30",
      Thu: "11:00-19:30",
      Fri: "OFF",
      Sat: "OFF",
    },
  },
];

const DOW_ORDER: DOW[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseTime(tStr: string): number {
  const t = tStr.replace(":", "");
  const h = parseInt(t.slice(0, 2), 10);
  const m = parseInt(t.slice(2, 4), 10);
  return h * 60 + m;
}

export function getLegacyCsaSupply(day: DOW): number[] {
  const out = new Array(48).fill(0);
  const targetDayIdx = DOW_ORDER.indexOf(day);

  for (const agent of LEGACY_ROSTER) {
    if (agent.role !== "Spanish CSR") continue;

    for (let d = 0; d < 7; d++) {
      const currentDay = DOW_ORDER[d];
      const shiftStr = agent.schedule[currentDay];
      if (!shiftStr || shiftStr === "OFF") continue;

      const clean = shiftStr.replace(/\s+/g, "");
      const parts = clean.split("-");
      if (parts.length !== 2) continue;

      const startMin = parseTime(parts[0]);
      let endMin = parseTime(parts[1]);

      if (endMin <= startMin) {
        endMin += 1440;
      }

      for (let m = startMin; m < endMin; m += 30) {
        const absoluteMinute = d * 1440 + m;
        const mappedDayIdx = Math.floor(absoluteMinute / 1440) % 7;
        if (mappedDayIdx === targetDayIdx) {
          const intervalIdx = Math.floor((absoluteMinute % 1440) / 30);
          out[intervalIdx]++;
        }
      }
    }
  }
  return out;
}

export function getLegacyOnDutyStaff(day: DOW, hour: number) {
  return LEGACY_ROSTER.filter((m) => {
    const shiftStr = m.schedule[day];
    if (!shiftStr || shiftStr === "OFF") return false;
    
    const clean = shiftStr.replace(/\s+/g, "");
    const parts = clean.split("-");
    if (parts.length !== 2) return false;
    
    const startMin = parseTime(parts[0]);
    let endMin = parseTime(parts[1]);
    if (endMin <= startMin) endMin += 1440;
    
    const targetMin = hour * 60;
    return targetMin >= startMin && targetMin < endMin;
  }).map((m) => {
    const shift = m.schedule[day];
    const parts = shift.replace(/\s+/g, "").split("-");

    return {
      agent: {
        id: m.name,
        role: m.role,
        position: m.role === "Supervisor" ? "Supervisor" : m.role === "Spanish CSR" ? "CSR" : "Line",
        shift_id: m.role,
        start_clock: parts[0],
        end_clock: parts[1],
      },
      voiceMinutes: 60,
    };
  });
}
