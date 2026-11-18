// Invented people, packages and messages for the preview. Same names and
// numbers as the MentorsMD App Clickthrough (Nov 11, 2026). Nothing here is
// real; the live mentors come from mentorsmd.com (src/lib/live.ts).
import { BEST_CODE } from "./match";

export type Mentor = {
  id: string;
  name: string;
  init: string;
  photo?: string | null;
  stage: string; // full rank, e.g. "Medical Student – Year 4"
  school: string;
  rate: number; // dollars an hour
  rating: number | null;
  reviews: number;
  specialties: string[];
  svc: string[]; // service codes, for the sample filters
  best: string[];
  bg: string[];
  roles: string[];
  langs: string;
  fun: string;
  reply: string;
  clients: string[];
  bio: string;
  bundles: [number, number][]; // [hours, price]
  pkgs: [string, string, number][]; // [title, what's in it, price]
  highlights?: string[];
  knownFor?: string[];
  live?: boolean;
  // Guided match + compare (src/lib/match.ts), in the website's codes.
  match: {
    best: string[]; // BEST_FOR codes
    stages: string[]; // strongest stages
    packageServices: string[];
    prices: number[]; // every offer's price, in cents
    roleTypes: string[];
    languages: string[];
    packageCount: number;
    fromRate: number; // lowest dollars an hour
  };
  // Profile extras from the website (live mentors).
  credential?: string;
  specialtyInterest?: string;
  research?: string;
  stagesLabel?: string;
};

export const SERVICES: Record<string, string> = {
  PERSONAL_STATEMENT: "Personal statement",
  SECONDARIES: "Secondaries",
  ACTIVITIES: "Activities & experiences",
  MMI: "MMI prep",
  TRADITIONAL_INTERVIEW: "Traditional interview prep",
  SCHOOL_LIST: "School list & strategy",
  MCAT: "MCAT tutoring",
  REAPPLICANT: "Reapplicant review",
};
const SPEC: Record<string, string> = {
  PERSONAL_STATEMENT: "Personal Statement",
  SECONDARIES: "Secondaries",
  ACTIVITIES: "Activities & Experiences",
  MMI: "Interview Prep",
  TRADITIONAL_INTERVIEW: "Interview Prep",
  SCHOOL_LIST: "School List & Strategy",
  MCAT: "MCAT",
  REAPPLICANT: "Reapplicants",
};
const specs = (svc: string[]) => [...new Set(svc.map((s) => SPEC[s]))];

export const BEST_FOR = ["Traditional MD", "DO", "MD-PhD", "Nontraditional / career changers", "Reapplicants", "Low GPA / upward trend", "International", "BS/MD"];
export const ACCEPTED = ["Georgetown", "Mount Sinai", "Ohio State", "PCOM", "Emory", "Tufts", "Baylor", "UCLA", "Duke", "Johns Hopkins"];

type Raw = Omit<Mentor, "specialties" | "match">;
const raw: Raw[] = [
  { id: "leah", name: "Jordan Ellis", init: "JE", stage: "Medical Student – Year 4", school: "Johns Hopkins School of Medicine", rate: 150, rating: 4.9, reviews: 23, svc: ["PERSONAL_STATEMENT", "SECONDARIES", "MMI"], best: ["Reapplicants", "Low GPA / upward trend"], bg: ["Reapplicant", "First-generation"], roles: ["Interviewer"], langs: "English (Native), Korean (Fluent)", fun: "Ran a half marathon the week of their MMI.", reply: "Usually replies within 4 hours", clients: ["Georgetown", "Johns Hopkins", "Tufts", "Emory"],
    bio: "I applied twice. The second time I rewrote my personal statement from scratch and got four interviews in a month. I now sit on student interview panels at Hopkins and help applicants find the story only they can tell.",
    bundles: [[3, 450], [5, 750], [10, 1500]], pkgs: [["Personal Statement, Start to Finish", "About 5 hours · 2 calls + 3 rounds of edits", 550], ["MMI Mock Day", "3 stations + written feedback · 2 hours", 240]] },
  { id: "ben", name: "Ben Okafor", init: "BO", stage: "Resident Physician · PGY-2", school: "UCSF · Internal Medicine", rate: 150, rating: 5.0, reviews: 31, svc: ["MMI", "TRADITIONAL_INTERVIEW", "SCHOOL_LIST"], best: ["Traditional MD", "Interview prep"], bg: ["Career changer"], roles: ["Interviewer", "Admissions committee"], langs: "English (Native), Yoruba (Conversational)", fun: "Former high-school chemistry teacher.", reply: "Usually replies within a day", clients: ["UCSF", "Stanford", "UCLA"],
    bio: "Six years on the interview trail as an applicant, then as an interviewer. I run mock interviews the way real panels do, then send written notes within 24 hours.",
    bundles: [[2, 300], [4, 600], [8, 1200]], pkgs: [["Interview Season Plan", "4 mocks across MMI and traditional · 4 hours", 580]] },
  { id: "sofia", name: "Sofia Marquez", init: "SM", stage: "Medical Student – Year 2", school: "Michigan State College of Osteopathic Medicine", rate: 85, rating: 4.8, reviews: 12, svc: ["SCHOOL_LIST", "ACTIVITIES", "MCAT"], best: ["DO", "Nontraditional / career changers"], bg: ["Non-traditional", "Gap years"], roles: ["Application screener"], langs: "English (Native), Spanish (Native)", fun: "Worked as an EMT for three years.", reply: "Usually replies within 6 hours", clients: ["MSUCOM", "KCU", "PCOM"],
    bio: "I came to medicine after EMS work and two gap years. I help applicants build balanced MD and DO lists and write activities that sound like a person.",
    bundles: [[3, 255], [5, 425]], pkgs: [["Balanced MD + DO School List", "25–30 schools with notes · 3 hours", 240]] },
  { id: "aaron", name: "Aaron Feld", init: "AF", stage: "Gap Year", school: "Starting at Icahn Mount Sinai, 2027", rate: 60, rating: 4.7, reviews: 8, svc: ["MCAT", "SCHOOL_LIST"], best: ["MCAT strategy"], bg: ["Gap years"], roles: [], langs: "English (Native), Hebrew (Conversational)", fun: "Scored 522 on his second MCAT.", reply: "Usually replies within 2 hours", clients: ["Mount Sinai"],
    bio: "I retook the MCAT and went up 11 points. I teach the study plan that got me there, week by week.",
    bundles: [[4, 240], [8, 480], [12, 720]], pkgs: [] },
  { id: "nina", name: "Nina Rao", init: "NR", stage: "Undergraduate Student · BS/MD", school: "Brown University, PLME", rate: 50, rating: 4.9, reviews: 9, svc: ["PERSONAL_STATEMENT", "TRADITIONAL_INTERVIEW"], best: ["BS/MD"], bg: ["First-generation"], roles: [], langs: "English (Native), Telugu (Fluent)", fun: "Started a free tutoring club in high school.", reply: "Usually replies within 3 hours", clients: ["Brown PLME", "Rice/Baylor"],
    bio: "I help high-school seniors with BS/MD essays and interviews. Students under 18 need a parent’s consent before we start.",
    bundles: [[2, 100], [5, 250]], pkgs: [["BS/MD Essay Pack", "Main essay + 2 supplements · 4 hours", 200]] },
  { id: "james", name: "James Whitfield", init: "JW", stage: "Medical Student – Year 3 · MD/PhD", school: "WashU School of Medicine", rate: 140, rating: 4.9, reviews: 15, svc: ["PERSONAL_STATEMENT", "SECONDARIES", "REAPPLICANT"], best: ["MD-PhD", "Reapplicants"], bg: ["Reapplicant"], roles: ["Admissions committee"], langs: "English (Native)", fun: "Keeps bees on his roof.", reply: "Usually replies within a day", clients: ["WashU", "Vanderbilt", "Penn"],
    bio: "MD/PhD essays are their own genre. I sat on the MSTP student committee and help applicants explain their research clearly.",
    bundles: [[3, 420], [6, 840]], pkgs: [["MD/PhD Essays Review", "Significance of research + MD/PhD essay · 4 hours", 560]] },
];
// Sample mentors in the website's codes, so guided match works the same.
const STAGE_OF: Record<string, string> = { PERSONAL_STATEMENT: "PERSONAL_STATEMENT", SECONDARIES: "SECONDARIES", ACTIVITIES: "ACTIVITIES", SCHOOL_LIST: "SCHOOL_LIST", MMI: "INTERVIEW_PREP", TRADITIONAL_INTERVIEW: "INTERVIEW_PREP" };
const ROLE_OF: Record<string, string> = { Interviewer: "INTERVIEWER", "Admissions committee": "COMMITTEE", "Application screener": "SCREENER" };
const sampleMatch = (m: Raw): Mentor["match"] => {
  const prices = [m.rate, ...m.bundles.map((b) => b[1]), ...m.pkgs.map((p) => p[2])].map((d) => d * 100);
  const perHour = [m.rate, ...m.bundles.map(([h, p]) => p / h)];
  return {
    best: m.best.map((b) => BEST_CODE[b]).filter(Boolean),
    stages: [...new Set(m.svc.map((s) => STAGE_OF[s]).filter(Boolean))],
    packageServices: m.svc.filter((s) => !STAGE_OF[s]),
    prices,
    roleTypes: m.roles.map((r) => ROLE_OF[r]).filter(Boolean),
    languages: m.langs.split(",").map((l) => l.replace(/\(.*\)/, "").trim()).filter(Boolean),
    packageCount: m.pkgs.length,
    fromRate: Math.round(Math.min(...perHour)),
  };
};
export const MENTORS: Mentor[] = raw.map((m) => ({ ...m, specialties: specs(m.svc), match: sampleMatch(m) }));
export const sampleMentor = (id: string) => MENTORS.find((m) => m.id === id);

export type Status = "PENDING_PAYMENT" | "IN_ESCROW" | "COMPLETED" | "RELEASED" | "REFUNDED" | "DISPUTE" | "REVISION";
export type Pkg = { id: string; mentor: string; title: string; hours: number; used: number; calls: number; status: Status; left?: number; reviewed?: boolean; revKind?: string; disputeText?: string; log: [string, string, string][] };
export type MPkg = { student: string; title: string; hours: number; used: number; status: Status; minor?: boolean };
export type Msg = ["me" | "them" | "sys", string];

export function initialState() {
  return {
    credit: 40,
    useCredit: true,
    twostep: true,
    devices: [
      { n: "This iPhone", w: "This device · last used now" },
      { n: "MacBook Air · Safari", w: "Last used Nov 9" },
      { n: "iPad · MentorsMD app", w: "Last used Oct 28" },
    ],
    pk: {
      p1: { id: "p1", mentor: "leah", title: "Personal statement · 6 hours", hours: 6, used: 5.5, calls: 3, status: "COMPLETED", left: 47,
        log: [["Written feedback, draft 3", "1 h", "Nov 9"], ["Call: story and structure", "1 h", "Nov 4"], ["Written feedback, draft 2", "30 min", "Oct 31"], ["Call: first draft review", "1 h", "Oct 27"], ["Written feedback, draft 1", "1 h", "Oct 24"], ["Kickoff call", "1 h", "Oct 21"]] },
      p2: { id: "p2", mentor: "ben", title: "Interview prep · 6 hours", hours: 6, used: 2.5, calls: 2, status: "IN_ESCROW",
        log: [["MMI mock: 4 stations", "1.5 h", "Nov 7"], ["Kickoff call", "1 h", "Oct 30"]] },
      p3: { id: "p3", mentor: "sofia", title: "School list & strategy · 3 hours", hours: 3, used: 3, calls: 2, status: "RELEASED", reviewed: true,
        log: [["Final school list (28 schools)", "1 h", "Sep 26"], ["Call: MD vs DO balance", "1 h", "Sep 19"], ["Call: kickoff", "1 h", "Sep 12"]] },
    } as Record<string, Pkg>,
    threads: {
      leah: [["them", "Draft 3 notes are on your package page. The opening is so much stronger now."], ["me", "Thank you! Should I cut the research paragraph?"], ["them", "Trim it to two sentences and keep the patient story. I marked the package complete so you can approve when you’re happy."]],
      ben: [["sys", "You booked a call: Tue, Nov 17 · 7:00 PM ET"], ["them", "For Tuesday, bring 2 ethics questions you find hard. We’ll do them MMI style."]],
      sofia: [["them", "Good luck this cycle, Priya! Send me your interview invites."]],
    } as Record<string, Msg[]>,
    mThreads: {
      jordan: [["them", "Hi Jordan, I’m reapplying this cycle. Do you have time for secondaries in December?"]],
      priya: [["them", "Thank you! Should I cut the research paragraph?"], ["me", "Trim it to two sentences and keep the patient story. I marked the package complete so you can approve when you’re happy."]],
      maya: [["them", "Uploaded my Emory and Duke secondaries."]],
      sam: [["sys", "Free intro call booked: Today · 5:30 PM ET · 15 min"]],
    } as Record<string, Msg[]>,
    mPk: {
      priya: { student: "Priya Shah", title: "Personal statement · 6 hours", hours: 6, used: 5.5, status: "COMPLETED" },
      maya: { student: "Maya Lin", title: "Secondaries · 10 hours", hours: 10, used: 9, status: "IN_ESCROW" },
      alex: { student: "Alex Kim", title: "BS/MD interview prep · 3 hours", hours: 3, used: 1, status: "IN_ESCROW", minor: true },
      dev: { student: "Dev Mehta", title: "MMI Mock Day", hours: 2, used: 2, status: "RELEASED" },
    } as Record<string, MPkg>,
    paused: false,
    minorsOk: true,
    gcal: true,
    window: 60,
    rate: 150,
    bundles: [[3, 450], [5, 750], [10, 1500]] as [number, number][],
    pay: { earnedMonth: 1176, next: "Nov 24", paid: 4368, pending: 1176 },
    apps: [
      { id: "a1", name: "Grace Liu", stage: "Medical Student – Year 3", school: "Duke University School of Medicine", svc: "Secondaries, MMI prep", status: "New", interviews: "0 of 3 senior team interviews", applied: "Nov 8" },
      { id: "a2", name: "Omar Haddad", stage: "Resident – PGY-1", school: "Northwestern Feinberg · Pediatrics", svc: "Traditional interview prep", status: "Interviewing", interviews: "2 of 3 senior team interviews", applied: "Nov 9" },
      { id: "a3", name: "Talia Brooks", stage: "Gap Year", school: "Starting at Penn, 2027", svc: "MCAT tutoring", status: "New", interviews: "0 of 3 senior team interviews", applied: "Nov 10" },
    ],
    disputes: [
      { id: "d1", student: "Chris Nguyen", mentor: "Aaron Feld", order: "MCAT plan · 8 hours", amount: 480, reason: "Mentor missed two calls", opened: "Nov 10", status: "Open",
        convo: [["student", "Aaron missed our Nov 3 and Nov 8 calls and hasn’t replied since."], ["admin", "Thanks Chris. I can see both calls had no mentor join. I’ve asked Aaron to reply within 24 hours."], ["mentor", "I’m sorry. I had a family emergency. I’m happy to refund the unused hours."]] as [string, string][] },
    ],
    minors: [
      { n: "Alex Kim", a: "17 · BS/MD applicant", p: "Parent: Susan Kim", s: "Consent signed Nov 2", ok: true },
      { n: "Riya Desai", a: "16 · BS/MD applicant", p: "Parent: Anil Desai", s: "Consent email sent Nov 10, not signed", ok: false },
    ],
    orders: [
      { id: "o1", who: "Priya Shah → Jordan Ellis", what: "Personal statement · 6 hours", amt: 900, st: "COMPLETED" as Status },
      { id: "o2", who: "Chris Nguyen → Aaron Feld", what: "MCAT plan · 8 hours", amt: 480, st: "DISPUTE" as Status },
      { id: "o3", who: "Maya Lin → Jordan Ellis", what: "Secondaries · 10 hours", amt: 1200, st: "IN_ESCROW" as Status },
      { id: "o4", who: "Ethan Cole → Ben Okafor", what: "Interview Season Plan", amt: 580, st: "PENDING_PAYMENT" as Status },
      { id: "o5", who: "Dev Mehta → Jordan Ellis", what: "MMI Mock Day", amt: 240, st: "RELEASED" as Status },
      { id: "o6", who: "Hana Sato → Sofia Marquez", what: "School list & strategy · 3 hours", amt: 255, st: "REFUNDED" as Status },
    ],
    people: [
      ["Priya Shah", "Student · 2027 cycle", "Active"],
      ["Jordan Ellis", "Mentor · Johns Hopkins", "Active"],
      ["Ben Okafor", "Mentor · UCSF", "Active"],
      ["Aaron Feld", "Mentor · Gap year", "In a dispute"],
      ["Chris Nguyen", "Student · 2027 cycle", "Active"],
      ["Alex Kim", "Student · Under 18", "Consent on file"],
      ["Mark Evans", "Student", "Suspended"],
    ] as [string, string, string][],
    leads: [
      ["Waitlist: Hannah W.", "Wants a DO mentor in Texas", "Nov 11"],
      ["Contact form: Parent of BS/MD student", "Asks about pricing for 17-year-olds", "Nov 10"],
      ["Join the team: Priya N.", "Wants to help with marketing", "Nov 9"],
    ] as [string, string, string][],
    log: [] as [string, string, string][],
  };
}
export type DemoState = ReturnType<typeof initialState>;

export const MENTOR_STUDENT_NAMES: Record<string, string> = { jordan: "Sofia Alvarez", maya: "Maya Lin", priya: "Priya Shah", sam: "Sam Torres", alex: "Alex Kim", dev: "Dev Mehta" };

export const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
export const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
export const first = (name: string) => name.replace("Dr. ", "").split(" ")[0];
