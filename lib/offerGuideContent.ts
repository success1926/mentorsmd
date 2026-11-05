// The built-in wording of the mentor Offer Guide pop-up
// (components/OfferGuide.tsx). Editable in Admin -> Website -> Offer guide;
// the fields are in lib/siteContent.ts (mentorGuide).
//
// Every rule below has to match the code. When one of these changes, change
// the wording here too:
//   - rate limits, bundle hours, package hours, offer limits: lib/options.ts
//   - 30% fee: lib/fee.ts
//   - payouts on the 24th, unused hours, disputes: lib/payoutRules.ts
//   - 48 hours, one last call or revision: lib/finishing.ts
//   - 30/60-minute blocks, 1 hour left, add 1/2/3/5 hours: lib/hours.ts
//   - unlocking: lib/unlock.ts
//   - feedback only, staying on the site, 24-hour replies: lib/agreement.ts
//   - no-shows: lib/callOutcomes.ts
// Hours in the examples are examples, never a standard. Don't add market
// rates, earnings claims or statistics here.

export const GUIDE_DEFAULTS = {
  title: "How To Set Up Your Offers",
  intro: "Examples and notes for structuring your offers on MentorsMD. Use what fits how you work and change the rest.",

  packagesIntro:
    "A specialized package is a titled offer with what's included and your estimate of the hours it takes. These are examples, not a standard: use your own experience to set the hours.",
  packageRules: [
    "Estimated hours are 1 to 40, in half-hour steps. Price = estimated hours × rate.",
    "Choose a format: calls only, written only, or calls + written. Calls and written work are used in 30- or 60-minute blocks.",
    "There's no due date. Students use the hours at their own pace.",
    "\"What's included\" needs at least 30 words: what you'll do together, what you need from the student, and what they get back.",
    "Pick a topic so students filtering by service can find the package. You can have up to 12 packages.",
  ],
  packageExamples: [
    {
      title: "Personal Statement, Start To Finish",
      hours: "6",
      format: "WRITTEN_CALL",
      topic: "Personal statement",
      included:
        "A 60-minute call to find your themes and story, about 4 hours of written feedback across your drafts, and a 60-minute call to go over the near-final version. You write every draft; I give feedback. Please send your activities list before the first call.",
      note: "Say roughly how many drafts the written hours usually cover.",
    },
    {
      title: "Secondaries Feedback",
      hours: "5",
      format: "WRITTEN",
      topic: "Secondaries",
      included:
        "About 5 hours of written feedback on your secondary essays. Send me your school list and each prompt with your draft, and I return comments in the document. You write the essays. If you have more schools than this covers, you can add hours.",
      note: "Essay counts vary a lot by school, so say what the hours assume.",
    },
    {
      title: "MMI Practice Series",
      hours: "3",
      format: "LIVE",
      topic: "MMI prep",
      included:
        "Three 60-minute mock MMI sessions on video. Each one runs practice stations with timed answers, then direct feedback on structure, reasoning and delivery. Tell me your interview dates and schools before we start so we can focus on what matters most.",
      note: "A shorter version works too: 30-minute calls can use the hours in smaller pieces.",
    },
    {
      title: "Traditional Interview Prep",
      hours: "2",
      format: "LIVE",
      topic: "Traditional interview prep",
      included:
        "Two 60-minute mock interviews on video, using common questions and questions drawn from your own application. After each one you get direct feedback on your answers. Please share your application and the school you're interviewing at before the first call.",
      note: "Good for a student with an interview coming up and a clear goal.",
    },
    {
      title: "School List Review",
      hours: "2",
      format: "WRITTEN_CALL",
      topic: "School list & strategy",
      included:
        "One hour reviewing your stats, activities and current school list, with written comments, then a 60-minute call to go through where to apply and why. Please send your MCAT, GPA, activities and draft list first. You leave with a list you understand.",
      note: "Advise on fit and strategy. Don't promise what any school will decide.",
    },
    {
      title: "Reapplicant Review",
      hours: "4",
      format: "WRITTEN_CALL",
      topic: "Reapplicant review",
      included:
        "About 2 hours reviewing your last application in writing, a 60-minute call on what to change this cycle, and a 60-minute follow-up call on your plan. Please send your last application and any feedback you received from schools before we start.",
      note: "Good for a student who needs a plan before they need edits.",
    },
  ],

  hourlyIntro: "Not all work fits a package. Hours are simpler when the scope is small, or when you can't tell yet how much help the student needs.",
  hourlyOptions: [
    {
      name: "Single Hour",
      what: "1 hour at your hourly rate. Switch it on or off, and choose calls, written work or both. Students can buy one hour and add more later.",
      fits: [
        "One focused question, or a read of one essay",
        "A student trying you out before buying more",
        "Work where the scope isn't clear yet",
      ],
    },
    {
      name: "Hour Bundle",
      what: "A block of hours bought up front. The form offers 2 to 20 hours, and you can have up to 6 bundles. Bundle hours work for calls and written work alike.",
      fits: [
        "A student who wants ongoing help across several stages",
        "Help that changes as the cycle goes on, from essays to interviews",
        "When you want to offer a small discount on more hours: a bundle can have its own rate, at least $50 an hour",
      ],
    },
    {
      name: "Specialized Package",
      what: "A titled offer with what's included, a format and your estimate of the hours. You can have up to 12.",
      fits: [
        "Work you've done before and can describe clearly",
        "A student who wants to know what they're getting for one goal",
        "Help you'd like students to find by topic in Browse",
      ],
    },
  ],
  hourlyNotes: [
    "Your hourly rate is whole dollars, from $50 to $2,000 an hour. Changing it never changes what an existing order paid.",
    "Any active package can grow: students can add 1, 2, 3 or 5 hours at that package's rate.",
    "A student with no hours left can still book you, once buying is open: a 30- or 60-minute pay-per-call at your hourly rate. This works even with Single Hour switched off.",
    "With Single Hour off, students can still book a free intro call and buy your bundles and packages.",
  ],

  notesIntro: "How to run the work well, and how the site handles it.",
  noteGroups: [
    {
      title: "Scope The Work Before They Buy",
      points: [
        "Buying opens for a student once you reply to their message or their free 15-minute intro call is held. Intro calls don't use hours.",
        "Use that first reply or intro call to ask what they need, where they are in the cycle and what deadlines they have.",
        "Then point them to the offer that fits, and be clear about what it doesn't cover.",
        "Base your estimate on how long the work takes you, and say what it assumes, such as the number of drafts or essays.",
      ],
    },
    {
      title: "Set Expectations",
      points: [
        "The site has no due dates, so agree on timing in messages: when you'll return drafts, and when the student's own deadlines are.",
        "Reply to messages within 24 hours. That's part of the mentor agreement.",
        "Keep your call hours and busy dates up to date, so students only book times you can make.",
        "Calls can be cancelled or moved on the site until 24 hours before. Inside 24 hours, a package call can still be moved, but only with a written reason sent to the other person.",
        "Be honest about what you can do. Don't promise an interview or an acceptance.",
      ],
    },
    {
      title: "Keep It On MentorsMD",
      points: [
        "You give feedback and guidance. Never write essays, statements or applications for a student, and never take tests for them.",
        "Keep payments, calls and file sharing on the site. Don't share your phone number, email or payment apps with students.",
        "Never ask for or accept passwords or login details.",
        "You can see when a student is under 18, and you can choose not to work with students under 18 in Settings.",
      ],
    },
    {
      title: "Log Your Hours",
      points: [
        "Calls are added to the log automatically. If a student doesn't join, the call counts as used. If you don't join, the student can book another one for free.",
        "Log written work in 30- or 60-minute blocks, with a note on what you worked on and a file if it helps. The student gets an email each time.",
        "Log soon after the work and be specific, e.g. \"Edited the second draft of the personal statement.\"",
        "Because the blocks are 30 or 60 minutes, tell students upfront how you round.",
        "You can't log more than the hours left, and booked calls count as used.",
      ],
    },
    {
      title: "When Hours Run Low",
      points: [
        "When a package gets down to 1 hour left, you and the student both get an email and the package shows Running Low.",
        "Bring it up early, while there's still time to decide. Use Suggest More Hours on the package page: pick 1, 2, 3 or 5 hours and add a short reason.",
        "It posts in your messages and emails the student a button to add them at the package's rate. Nothing is charged unless they add them.",
        "A package's hours are an estimate. If the work will take longer, ask before you do it, because you can't log past the hours left.",
      ],
    },
    {
      title: "Finish A Package",
      points: [
        "Click Mark Work Complete when you're done. You can do this at any time, unless a call is still booked on the package.",
        "The student then has 48 hours to approve, ask for one last call or revision, or open a dispute. If they don't answer, it's approved automatically.",
        "They can ask for one last call or one last revision, once per package. A last call uses the package's hours, so leave some room if you can. If none are left, they add hours first.",
        "After that, mark it complete again. The student gets a fresh 48 hours, with only approve or dispute.",
        "Unused hours aren't refunded. You're paid for them once the package is approved, so finishing efficiently never costs you.",
      ],
    },
    {
      title: "Getting Paid",
      points: [
        "You earn 70% of every hour. MentorsMD keeps 30%.",
        "Payouts go out once a month, on the 24th: one transfer for hours logged and calls held so far, including on active packages, plus unused hours on packages approved by then.",
        "Students can't buy until your payouts are connected. Stripe collects your bank details, tax info and ID directly.",
        "If a student opens a dispute, that package's hours are held back until an admin decides. Any refund is given as MentorsMD credit and comes out of what you haven't been paid yet for that package. A refund of everything the student paid means nothing more is paid on it. Hours paid in earlier months aren't taken back.",
      ],
    },
  ],
};
