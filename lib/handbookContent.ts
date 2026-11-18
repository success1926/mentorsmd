// The built-in wording of the Mentor Handbook (/dashboard/handbook, only
// for logged-in mentors and admins). Editable in Admin -> Website -> Mentor
// handbook; the fields are in lib/siteContent.ts (mentorHandbook).
//
// A point that starts with **bold words** shows those words in bold.
//
// Some points describe the site's rules. When one of these changes, change
// the wording here too:
//   - 70% / 30%: lib/fee.ts
//   - payouts on the 24th, disputes: lib/payoutRules.ts
//   - 48 hours after "Mark work complete": lib/finishing.ts
//   - 15-minute intro call: lib/unlock.ts
//   - staying on the site, feedback only, 24-hour replies: lib/agreement.ts
// The tax section is general US information, not tax advice.

export const HANDBOOK_DEFAULTS = {
  title: "Mentor Handbook",
  intro: "What to know about freelancing on MentorsMD: pricing without haggling, taxes, and running your mentoring like a small business.",
  sections: [
    {
      title: "Set your price so there's nothing to negotiate",
      intro: "Your rate is on your profile before a student ever messages you. That's your best protection: the price is already decided, so the conversation can be about the work.",
      points: [
        "**Pick one hourly rate and stand by it.** A clear, published rate reads as confident. A rate that moves when someone pushes teaches every student to push.",
        "**Change the scope, not the price.** If a student says it's too much, offer less work at the same rate: \"I can't lower my rate, but I can do a focused 1-hour read of your top three activities instead of the full 3-hour review.\"",
        "**Let bundles be your only discount.** If you want to reward commitment, give your hour bundles a lower per-hour rate. It's the same for everyone, it's on your profile, and you never have to decide case by case.",
        "**Use the free 15-minute intro call to show value.** Students who've talked to you rarely haggle. Spend it understanding their goals and saying what you'd do, not giving the full advice away.",
        "**Answer once, politely, and move on.** \"My rate is $X/hour. Here's what I'd suggest for your budget.\" Don't apologize, explain your finances or go back and forth. If it isn't a fit, that's fine.",
        "**Raise your rate for new students, not current ones.** Once you have reviews and steady bookings, raise it on your profile. Students who already bought hours keep what they paid for.",
        "**Never take a deal off the site.** Discounts for paying by Venmo, Zelle, cash or anything else break the Community Guidelines, and you lose our help if anything goes wrong.",
      ],
    },
    {
      title: "How you get paid",
      intro: "",
      points: [
        "You keep 70% of every hour you work; MentorsMD keeps 30%, which covers payments, the calendar, video calls, messages and support.",
        "Payouts go to your bank on the 24th of each month through Stripe, for every hour approved since the last payout.",
        "When you mark work complete, the student has 48 hours to respond; after that it's approved automatically.",
        "Hours on a package with an open dispute wait until the dispute is decided.",
      ],
    },
    {
      title: "Taxes for freelancers (US)",
      intro: "You're an independent contractor, not an employee of MentorsMD. Nobody takes tax out of your payouts, so planning for it is on you. This is general information, not tax advice: for your own situation, ask a tax professional.",
      points: [
        "**Set aside 25–30% of every payout.** Move it to a separate savings account the day it arrives, so tax time isn't a surprise.",
        "**Self-employment tax is on top of income tax.** It's 15.3% (Social Security and Medicare) on your net freelance earnings once they reach $400 in a year, because no employer is paying its half.",
        "**You may need to pay every quarter.** If you expect to owe $1,000 or more for the year, the IRS expects estimated payments, usually due in mid-April, mid-June, mid-September and mid-January. Missing them can mean penalties. IRS Form 1040-ES explains it.",
        "**Report everything, form or no form.** Stripe collects your tax details when you connect your bank. If your earnings pass the IRS reporting threshold you'll get a 1099 form early in the year, but all of your income is taxable even if you don't get one.",
        "**It goes on Schedule C.** Your MentorsMD income and business expenses go on Schedule C with your normal tax return, and the self-employment tax on Schedule SE.",
        "**Keep records and claim your expenses.** Things used for the work can usually be deducted: a share of your phone and internet, software, a webcam or microphone, prep books you buy for mentoring, and a home office used only for work. Keep receipts. Your Payouts page has your earnings history.",
        "**Don't forget your state.** Most states have their own income tax, and some cities do too.",
        "**On a student visa? Check first.** F-1 and J-1 visas strictly limit work, and freelancing can put your status at risk. Talk to your school's international student office before you take any paid work.",
      ],
    },
    {
      title: "Your school, your future, your reputation",
      intro: "",
      points: [
        "Check your medical school's (or college's) policy on outside work and admissions advising. Some ask you to tell them first.",
        "If you've ever served on an admissions committee or read applications, never share anything confidential, and never mentor someone your committee is reviewing.",
        "Don't promise results. Nobody can guarantee an interview or an acceptance, and saying so can hurt you and MentorsMD.",
        "Mentors give feedback and guidance. You never write essays, personal statements, secondaries or activity descriptions for a student.",
      ],
    },
    {
      title: "Work like a professional",
      intro: "",
      points: [
        "**Agree the plan in writing.** Before you start, say in Messages what you'll do and roughly how many hours it will take. It prevents almost every dispute.",
        "**Reply within 24 hours.** Fast replies win bookings and reviews. If you're busy, a quick \"Got it, I'll have this to you by Thursday\" counts.",
        "**Protect your time.** Set call hours that fit your schedule and add busy dates for exams, rotations and holidays. You can pause your profile in Settings when you need a break.",
        "**Keep everything on MentorsMD.** Messages, calls and files stay on the site, so there's a record if a question ever comes up.",
        "**Log your time honestly.** Students see the hours you log. Accurate logs build trust and repeat students.",
        "**Ask for a review.** When a package goes well, ask the student to leave a review. It's the single biggest thing that brings new students to you.",
      ],
    },
  ],
  helpTitle: "Need a hand?",
  helpText: "Questions about pricing, a tricky student or a payout? Contact the MentorsMD team. The full rules are in the Community Guidelines and the Mentor Agreement, and the Offer Guide walks through setting up your packages.",
};

// "**Bold words** the rest" -> { lead: "Bold words", text: "the rest" }.
export function splitLead(point: string): { lead: string; text: string } {
  const m = /^\*\*(.+?)\*\*\s*([\s\S]*)$/.exec(point.trim());
  return m ? { lead: m[1], text: m[2] } : { lead: "", text: point };
}
