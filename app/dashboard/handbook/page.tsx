import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";

export const metadata = { title: "Mentor Handbook", robots: { index: false } };
export const dynamic = "force-dynamic";

// What every mentor should know about working as a freelancer on MentorsMD:
// pricing without haggling, taxes, and working like a professional. Only
// logged-in mentors (and admins, to read it) can open it: /dashboard is a
// login-only path in middleware.ts, and anyone else is sent home here.
// The tax section is general US information, not tax advice.

type Section = { id: string; title: string; intro?: string; points: (string | { lead: string; text: string })[] };

const SECTIONS: Section[] = [
  {
    id: "rates",
    title: "Set your price so there's nothing to negotiate",
    intro: "Your rate is on your profile before a student ever messages you. That's your best protection: the price is already decided, so the conversation can be about the work.",
    points: [
      { lead: "Pick one hourly rate and stand by it.", text: "A clear, published rate reads as confident. A rate that moves when someone pushes teaches every student to push." },
      { lead: "Change the scope, not the price.", text: "If a student says it's too much, offer less work at the same rate: \"I can't lower my rate, but I can do a focused 1-hour read of your top three activities instead of the full 3-hour review.\"" },
      { lead: "Let bundles be your only discount.", text: "If you want to reward commitment, give your hour bundles a lower per-hour rate. It's the same for everyone, it's on your profile, and you never have to decide case by case." },
      { lead: "Use the free 15-minute intro call to show value.", text: "Students who've talked to you rarely haggle. Spend it understanding their goals and saying what you'd do, not giving the full advice away." },
      { lead: "Answer once, politely, and move on.", text: "\"My rate is $X/hour. Here's what I'd suggest for your budget.\" Don't apologize, explain your finances or go back and forth. If it isn't a fit, that's fine." },
      { lead: "Raise your rate for new students, not current ones.", text: "Once you have reviews and steady bookings, raise it on your profile. Students who already bought hours keep what they paid for." },
      { lead: "Never take a deal off the site.", text: "Discounts for paying by Venmo, Zelle, cash or anything else break the Community Guidelines, and you lose our help if anything goes wrong." },
    ],
  },
  {
    id: "money",
    title: "How you get paid",
    points: [
      `You keep ${100 - PLATFORM_FEE_PERCENT}% of every hour you work; MentorsMD keeps ${PLATFORM_FEE_PERCENT}%, which covers payments, the calendar, video calls, messages and support.`,
      "Payouts go to your bank on the 24th of each month through Stripe, for every hour approved since the last payout.",
      "When you mark work complete, the student has 48 hours to respond; after that it's approved automatically.",
      "Hours on a package with an open dispute wait until the dispute is decided.",
    ],
  },
  {
    id: "taxes",
    title: "Taxes for freelancers (US)",
    intro: "You're an independent contractor, not an employee of MentorsMD. Nobody takes tax out of your payouts, so planning for it is on you. This is general information, not tax advice: for your own situation, ask a tax professional.",
    points: [
      { lead: "Set aside 25–30% of every payout.", text: "Move it to a separate savings account the day it arrives, so tax time isn't a surprise." },
      { lead: "Self-employment tax is on top of income tax.", text: "It's 15.3% (Social Security and Medicare) on your net freelance earnings once they reach $400 in a year, because no employer is paying its half." },
      { lead: "You may need to pay every quarter.", text: "If you expect to owe $1,000 or more for the year, the IRS expects estimated payments, usually due in mid-April, mid-June, mid-September and mid-January. Missing them can mean penalties. IRS Form 1040-ES explains it." },
      { lead: "Report everything, form or no form.", text: "Stripe collects your tax details when you connect your bank. If your earnings pass the IRS reporting threshold you'll get a 1099 form early in the year, but all of your income is taxable even if you don't get one." },
      { lead: "It goes on Schedule C.", text: "Your MentorsMD income and business expenses go on Schedule C with your normal tax return, and the self-employment tax on Schedule SE." },
      { lead: "Keep records and claim your expenses.", text: "Things used for the work can usually be deducted: a share of your phone and internet, software, a webcam or microphone, prep books you buy for mentoring, and a home office used only for work. Keep receipts. Your Payouts page has your earnings history." },
      { lead: "Don't forget your state.", text: "Most states have their own income tax, and some cities do too." },
      { lead: "On a student visa? Check first.", text: "F-1 and J-1 visas strictly limit work, and freelancing can put your status at risk. Talk to your school's international student office before you take any paid work." },
    ],
  },
  {
    id: "school",
    title: "Your school, your future, your reputation",
    points: [
      "Check your medical school's (or college's) policy on outside work and admissions advising. Some ask you to tell them first.",
      "If you've ever served on an admissions committee or read applications, never share anything confidential, and never mentor someone your committee is reviewing.",
      "Don't promise results. Nobody can guarantee an interview or an acceptance, and saying so can hurt you and MentorsMD.",
      "Mentors give feedback and guidance. You never write essays, personal statements, secondaries or activity descriptions for a student.",
    ],
  },
  {
    id: "professional",
    title: "Work like a professional",
    points: [
      { lead: "Agree the plan in writing.", text: "Before you start, say in Messages what you'll do and roughly how many hours it will take. It prevents almost every dispute." },
      { lead: "Reply within 24 hours.", text: "Fast replies win bookings and reviews. If you're busy, a quick \"Got it, I'll have this to you by Thursday\" counts." },
      { lead: "Protect your time.", text: "Set call hours that fit your schedule and add busy dates for exams, rotations and holidays. You can pause your profile in Settings when you need a break." },
      { lead: "Keep everything on MentorsMD.", text: "Messages, calls and files stay on the site, so there's a record if a question ever comes up." },
      { lead: "Log your time honestly.", text: "Students see the hours you log. Accurate logs build trust and repeat students." },
      { lead: "Ask for a review.", text: "When a package goes well, ask the student to leave a review. It's the single biggest thing that brings new students to you." },
    ],
  },
];

export default async function MentorHandbookPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "SELLER" && role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="page-mid stack-lg">
      <div className="stack-sm">
        <h1 className="page-title">Mentor Handbook</h1>
        <p className="lede">What to know about freelancing on MentorsMD: pricing without haggling, taxes, and running your mentoring like a small business.</p>
        <nav aria-label="On this page" style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="link">{s.title}</a>
          ))}
        </nav>
      </div>

      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="stack-sm" style={{ scrollMarginTop: 90 }}>
          <h2 style={{ fontSize: 24 }}>{s.title}</h2>
          {s.intro && <p className="text-secondary" style={{ lineHeight: 1.6 }}>{s.intro}</p>}
          <ul className="stack-sm text-secondary" style={{ paddingLeft: 20, lineHeight: 1.6 }}>
            {s.points.map((p) =>
              typeof p === "string" ? (
                <li key={p}>{p}</li>
              ) : (
                <li key={p.lead}><b style={{ color: "var(--ink)" }}>{p.lead}</b> {p.text}</li>
              ),
            )}
          </ul>
        </section>
      ))}

      <section className="card card-tint stack-sm">
        <h2 style={{ fontSize: 20 }}>Need a hand?</h2>
        <p className="text-secondary" style={{ lineHeight: 1.6 }}>
          Questions about pricing, a tricky student or a payout? <Link href="/contact" className="link">Contact the MentorsMD team</Link>. The full rules are in
          the <Link href="/community-guidelines" className="link">Community Guidelines</Link> and the{" "}
          <Link href="/mentor-agreement" className="link">Mentor Agreement</Link>, and the <Link href="/dashboard/offer-guide" className="link">Offer Guide</Link> walks
          through setting up your packages.
        </p>
      </section>
    </div>
  );
}
