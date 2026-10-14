// What happened at a call: held, a no-show, or nobody joined. Pure
// functions, safe to import from both server and client code. The cron
// that applies them is lib/callOutcomeRunner.ts.
//
// Decided policy (see the open-questions doc, items 4 and 5):
//   - Held: the student and mentor were both in the call together for
//     10+ minutes.
//   - Student no-show: the mentor joined and the student hadn't joined by
//     15 minutes after the start. The call counts as used.
//   - Mentor no-show: the student joined and the mentor wasn't there by
//     15 minutes after the start. The student gets a free rebook (the
//     call no longer counts). A second one on the same order lets the
//     student open a dispute, with a full refund as the expected outcome.
//   - Nobody joined: not counted either way; an admin decides.
// The numbers are constants so each one is a one-line change.

export const NO_SHOW_WAIT_MINUTES = 15; // how late someone can be before it's a no-show
export const HELD_OVERLAP_MINUTES = 10; // both in the call together this long = held
export const DECIDE_AFTER_END_MINUTES = 30; // wait for Daily's late "left" events
// Calls that ended longer ago than this without an outcome (from before
// this feature, or if the cron was down) count as held, the old rule.
export const DECIDE_WITHIN_HOURS = 48;
// When a "left" event never arrives, assume they stayed until the Join
// button closed (30 minutes after the end; matches JOIN_CLOSES_MINUTES_AFTER).
const ASSUME_LEFT_AFTER_END_MINUTES = 30;

export const OUTCOMES = ["HELD", "STUDENT_NO_SHOW", "MENTOR_NO_SHOW", "NOBODY_JOINED", "UNCLEAR", "FREE_REBOOK"] as const;
export type CallOutcome = (typeof OUTCOMES)[number];

// The call counts as used (the student had their chance).
export const COUNTS_AS_HELD: readonly string[] = ["HELD", "STUDENT_NO_SHOW"];
// The call no longer counts toward the package, so the student can book again.
export const FREES_THE_CALL: readonly string[] = ["MENTOR_NO_SHOW", "FREE_REBOOK"];
// Neither: waiting for an admin to decide.
export const NEEDS_ADMIN: readonly string[] = ["NOBODY_JOINED", "UNCLEAR"];

export const isOutcome = (v: unknown): v is CallOutcome => typeof v === "string" && (OUTCOMES as readonly string[]).includes(v);

// Plain words for the order page and Admin.
export function outcomeLabel(outcome: string | null | undefined, viewer: "student" | "mentor" | "admin" = "admin"): string {
  switch (outcome) {
    case "HELD":
      return "Call held";
    case "STUDENT_NO_SHOW":
      return viewer === "student" ? "You didn't join, so this call counts as used" : "The student didn't join, so this call counts as used";
    case "MENTOR_NO_SHOW":
      return viewer === "student"
        ? "Your mentor didn't join. This call doesn't count, so you can book another one for free"
        : viewer === "mentor"
          ? "You didn't join. The student can book another call for free"
          : "Mentor didn't join (free rebook for the student)";
    case "FREE_REBOOK":
      return viewer === "admin" ? "Free rebook given" : "This call doesn't count, so another one can be booked for free";
    case "NOBODY_JOINED":
      return viewer === "admin" ? "Nobody joined: needs a decision" : "Nobody joined. The MentorsMD team will be in touch";
    case "UNCLEAR":
      return viewer === "admin" ? "Unclear (both late or a very short call): needs a decision" : "We're checking what happened. The MentorsMD team will be in touch";
    default:
      return "";
  }
}

export type AttendanceLike = { userId: string | null; joinedAt: string | Date; leftAt?: string | Date | null };

type Interval = { s: number; e: number };

function intervalsFor(rows: AttendanceLike[], userId: string, end: number): Interval[] {
  const fallbackLeft = end + ASSUME_LEFT_AFTER_END_MINUTES * 60_000;
  return rows
    .filter((r) => r.userId === userId)
    .map((r) => {
      const s = new Date(r.joinedAt).getTime();
      const e = r.leftAt ? new Date(r.leftAt).getTime() : fallbackLeft;
      return { s, e: Math.max(s, e) };
    })
    .filter((i) => !isNaN(i.s) && !isNaN(i.e));
}

// Total time both people were in the call at once, in minutes.
function overlapMinutes(a: Interval[], b: Interval[]) {
  // Merge each person's own sessions first (rejoining after a dropped
  // connection gives several), so nothing is counted twice.
  const merge = (list: Interval[]) =>
    list
      .slice()
      .sort((x, y) => x.s - y.s)
      .reduce<Interval[]>((out, i) => {
        const last = out[out.length - 1];
        if (last && i.s <= last.e) last.e = Math.max(last.e, i.e);
        else out.push({ ...i });
        return out;
      }, []);
  let ms = 0;
  for (const x of merge(a)) for (const y of merge(b)) ms += Math.max(0, Math.min(x.e, y.e) - Math.max(x.s, y.s));
  return ms / 60_000;
}

// Decides a call's outcome from Daily's attendance log.
//   webhookOn: DAILY_WEBHOOK_SECRET is set, so attendance is being
//   recorded. Without it there's nothing to go on, and a call with no
//   attendance counts as held (the old rule).
export function classifyCall(input: {
  start: string | Date;
  end: string | Date;
  studentId: string;
  mentorId: string;
  attendance: AttendanceLike[];
  webhookOn: boolean;
}): CallOutcome {
  const start = new Date(input.start).getTime();
  const end = new Date(input.end).getTime();
  const rows = input.attendance || [];
  if (rows.length === 0) return input.webhookOn ? "NOBODY_JOINED" : "HELD";

  const student = intervalsFor(rows, input.studentId, end);
  const mentor = intervalsFor(rows, input.mentorId, end);
  // Someone joined, but not as the student or mentor (e.g. only a team
  // member): a person should look.
  if (!student.length && !mentor.length) return "UNCLEAR";

  const deadline = start + NO_SHOW_WAIT_MINUTES * 60_000;
  const first = (list: Interval[]) => Math.min(...list.map((i) => i.s));
  const studentOnTime = student.length > 0 && first(student) <= deadline;
  const mentorOnTime = mentor.length > 0 && first(mentor) <= deadline;

  if (student.length && mentor.length && overlapMinutes(student, mentor) >= HELD_OVERLAP_MINUTES) return "HELD";
  if (mentor.length && !studentOnTime && (mentorOnTime || !student.length)) return "STUDENT_NO_SHOW";
  if (student.length && !mentorOnTime && (studentOnTime || !mentor.length)) return "MENTOR_NO_SHOW";
  // Both were on time but the call was short: they both showed up.
  if (studentOnTime && mentorOnTime) return "HELD";
  // Both late, and not together for long.
  return "UNCLEAR";
}
