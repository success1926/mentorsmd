# MentorsMD: open questions (running list)

Last updated: Oct 18, 2026. All six phases are live (merged Oct 12). The hourly-pricing redesign (`docs/redesign-2026-10.md`, branch `hourly-redesign`) changes how packages, payments and payouts work; the decisions it replaces are marked **Replaced** below and summarised in "Hourly redesign (Oct 18, 2026)".

On Oct 14, 2026 the owner confirmed every recommended answer, so every item below is now **Decided** and the code uses it. Where an answer is a number, it's a one-line constant (file noted) so changing your mind later is quick. New questions go at the end as "Open".

## Hourly redesign (Oct 18, 2026)

All decided with the owner; the code follows `docs/redesign-2026-10.md`.

- **Hourly pricing.** Each mentor sets one hourly rate ($50 to $2,000, whole dollars). They sell Hourly (1 hour), hour bundles and specialized packages; every price is hours x rate (`lib/pricing.ts`). No typed-in prices, no turnaround, no number of calls.
- **Free intro calls.** A student can always message a mentor, and book one free 15-minute intro call per mentor. Buying unlocks once the mentor has replied or the intro call was held (`lib/unlock.ts`, `lib/introCalls.ts`).
- **No due dates.** Packages have no due date. The old due-date, overdue, on-hold, forfeit and "book your call" rules, crons and emails are gone (items 1, 6 and 8 below are replaced).
- **Hours.** Calls (30 or 60 minutes) and written work (logged by the mentor in 30/60-minute blocks) use the package's hours; held calls are logged automatically. Students add hours at the package's rate, or pay per call when they have none left (`lib/hours.ts`, `lib/hourLog.ts`, `lib/hourCheckout.ts`).
- **48 hours to respond.** The mentor marks the work complete any time; the student then has 48 hours to approve, ask for one last call or one last revision (once per package), or open a dispute. No answer = approved automatically (`lib/finishing.ts`, `lib/orderFinish.ts`, run by `/api/cron/call-reminders`). Unused hours aren't refunded; they're paid to the mentor.
- **Monthly payouts.** Mentors are paid once a month, on the **24th** (New York time; `/api/cron/monthly-payouts`, `0 14 24 * *` UTC), one Stripe transfer each: hours logged since their last payout, plus the unused hours of packages approved by then, at 70% (`lib/payoutRules.ts`, `lib/payouts.ts`). Hours on a package with an open dispute wait until it's decided. Mentors without connected payouts are skipped until they connect. Admin -> Orders & payouts lists every payout; the Owner has "Run payouts now" (pays the latest month to anyone not paid for it yet, never twice), and failed payouts have Retry (Stripe is checked first, so nothing is sent twice). Failures are reported to Sentry as "[NEEDS MANUAL CHECK]" and badge the sidebar.
- **MentorsMD credit.** Refunds are never sent back to the card: an admin settles a dispute with **Refund as credit** (full or partial, up to what the student paid including added hours and credit they used). Credit never expires, works with any mentor and is applied first at checkout. Admins with the Orders permission can add or remove credit on a student (Admin -> People), with a required reason that goes in the action log (`lib/credit.ts`, `lib/creditAdmin.ts`).
- **Refund-as-credit rule.** A refund of $X closes the package. A full refund (everything the student paid) marks it Refunded and nothing more is paid to the mentor. A partial refund approves it, and $X is taken off the mentor's final payout for that package: (unpaid hours + unused hours) x rate, minus $X, never below zero. Hours already paid to the mentor in earlier months aren't taken back (MentorsMD covers that part). The hours log isn't changed.
- **Payment wording.** "Payment held until you approve" no longer fits (mentors are paid monthly for hours worked), so public pages now say "Pay for hours, see every one" / "Secure payments through MentorsMD". Never say "pay when you're happy".

## Calls and scheduling

1. **Unbooked call at the deadline.** **Replaced** by the hourly redesign: packages have no due date, so nothing is put on hold or forfeited (`lib/callRules.ts` was removed). The original decision, for the record:
   - Decided (was built in):
     - While a call is unbooked, the student gets a "Book your call" reminder every 3 days.
     - At the due date, if it's still unbooked, the order goes **On hold**.
       - The mentor sees: Extend due date / Message student / Ask admin.
       - The student sees: Book now / I don't need the call.
     - After 48 hours on hold:
       - If the mentor had call hours set (the student could have booked), the call is **forfeited**, and the mentor can mark the work complete and get paid.
       - If the mentor had no call hours set, the order stays on hold for an admin to decide.
     - The mentor can never mark complete while an included call is still owed.
     - A call given back after a mentor no-show (item 4) is never put on hold or forfeited automatically; the student keeps getting "Book your call" reminders, and an admin decides if it drags on.
   - Why: this is your idea (48h warning, mentor blocked), but the outcome depends on who caused the delay, so mentors aren't punished for a student going quiet.
2. **Cancel / reschedule cutoff.**
   - Decided (built in, `CANCEL_CUTOFF_HOURS` in `lib/calls.ts`):
     - Up to **24 hours** before the call, Reschedule and Cancel work on the site's built-in calendar (Reschedule picks a new time from the mentor's call hours).
     - Inside 24 hours the buttons disappear. The page says to message the other person or contact us.
3. **When Join opens.** Decided: **10 minutes before**, staying open until 30 minutes after the scheduled end (built in). Join opens the call's own private Daily room.
4. **No-shows.** Decided, and built (Oct 14, 2026). Numbers are constants in `lib/callOutcomes.ts`.
   - About 30 minutes after a call ends, the every-15-minutes call cron (`/api/cron/call-reminders`, `lib/callOutcomeRunner.ts`) looks at who joined (Daily's attendance, item 5) and saves an outcome on the call:
     - **Held:** both were in the call together for 10+ minutes (or both were on time and the call was just short).
     - **Student no-show:** the mentor joined and the student hadn't joined 15 minutes after the start. The call counts as used. Both get an email; the mentor's asks them to message the student so there's a record, and the order page shows the mentor a "message the student" link.
     - **Mentor no-show:** the student joined and the mentor wasn't there 15 minutes after the start (or never came). The call no longer counts, so the student can **book another one for free**. Both get an email, and a low-severity "Missed call" flag is raised about the mentor.
     - **Second mentor no-show on the same order:** a **high-severity** flag goes to every admin. (Before the redesign the student was told to open a dispute for a full refund; on hours packages the missed time simply goes back to their hours, and any refund an admin grants is MentorsMD credit.)
     - **Nobody joined** (or it's unclear, e.g. both very late): it doesn't count either way. Both get an email saying the team will be in touch, and a flag asks an admin to decide.
   - Admin -> Calls & recordings shows each past call's outcome (automatic or set by an admin) and buttons to change it: Count as held, Give a free rebook, Mark student no-show, Mark mentor no-show (needs the Calls permission; every change is in the Action log). The two no-show buttons send the same emails; "Count as held" and "Give a free rebook" send nothing, so tell the people yourself.
   - The package page shows each past call's outcome in plain words. Held calls and student no-shows are added to the hours log at their booked length; a mentor no-show gives the time back.
   - Emails (editable in Admin -> Emails): `call_student_no_show_student`, `call_student_no_show_mentor`, `call_mentor_no_show_student`, `call_mentor_no_show_mentor`, `call_nobody_joined`.
5. **What counts as a call that happened.** Decided, and built (Oct 14, 2026):
   - A call counts as held when the student and mentor were both in it for 10+ minutes, using Daily's join/leave events (the Daily webhook, Admin -> Calls & recordings -> "Connect Daily webhook").
   - If the webhook isn't set up (no `DAILY_WEBHOOK_SECRET`) and there's no attendance, the old rule applies: once the end time has passed, the call counts as held. If the webhook is set up but nothing arrived, it's "nobody joined".
   - Calls that ended more than 48 hours ago without an outcome (from before this was built) count as held, as before.
6. **Book-by date.** **Replaced**: there are no due dates, so there's no book-by date. Students book calls from their hours whenever they like.
7. **Calendar sync.**
   - Built:
     - Every user gets a private calendar link on Account → Calendar & calls, with one-click Google / Outlook / Apple buttons.
     - It shows their booked calls (including intro calls) and updates on its own.
     - Mentors set weekly call hours and busy dates on the site (Account → Call availability), and can paste a private Google/iCloud calendar link so their busy times are hidden from students.
   - Decided: stop there. Full Google/Outlook two-way connection needs Google app verification and isn't worth it yet.

## Payments and orders

8. **Review window.** **Replaced**: 48 hours after the mentor marks the work complete (see "Hourly redesign"). The old 96-hour release is gone.
9. **Discount codes.** Decided: **no promos**. Discount codes were removed completely on Oct 13, 2026: the code and admin API are gone, and the database table is dropped with `prisma/cleanup-2026-10-drop-discount-codes.sql` once that change is live.
10. **Forfeited or skipped calls and payment.** **Replaced**: calls aren't forfeited any more, and unused hours are paid to the mentor once the package is approved. Refunds stay a case-by-case admin call through disputes, always as MentorsMD credit.
11. *(merged into 10)*

## Vetting

12. **How the senior team vets mentors.** Decided: every mentor has a rigorous interview with each senior team member. Mentors are invite-only.
13. **Acceptance rate.** Decided: **not shown**. Mentors are invite-only, so there's no application rate to quote. The setting was removed (Oct 14, 2026) and the homepage always says "Invite-only".

## Browse and packages

14. **Service list.** Decided: the 8 services plus **"Other"** (built in): a mentor picking Other types a short custom service name, which shows everywhere in place of the word "Other" and can be searched.
15. **Price ranges.** Decided, built in: **$50–$100, $100–$250, $250–$500, $500+** (`PRICE_BANDS` in `lib/options.ts`), now worked out from each offer's hours x rate. Revisit when you see real prices.
16. **Calls per package.** **Replaced**: packages sell hours; calls are 30 or 60 minutes, booked from the hours.

## Mentor accounts and admin

17. **Paused mentors.** Decided: **yes, they come back automatically** on the return date (built in). No return date means they stay paused until they switch it off.
18. **Mentors who remove themselves.**
    - Decided: they can **restore on their own** from Account (built in).
    - Mentors removed *by an admin* can't log in, and only an admin can restore them.
19. **Admin removing a mentor with active orders.**
    - Decided: **don't auto-refund**. Removal hides the mentor and blocks login.
    - The admin then settles each active package (a dispute: refund as credit, or approve for the mentor). The admin page shows how many active orders there are when you remove someone.
    - For a mentor who left in good standing, prefer pausing them so they can finish.

## Content to supply

20. **Real content** (anything left empty is hidden, never shown as a placeholder). Most of it is now edited on the site, in Admin -> Website (draft, preview, publish):
    - Schools strip, testimonials, homepage photos and the vetting points: Admin -> Website -> Homepage. (`lib/content.ts` only holds the built-in defaults.)
    - Senior team (`/senior-team`, which `/founders` redirects to): real names, titles, bios and photos are in; edit them in Admin -> Website -> Senior team.
    - Social links: Admin -> Website -> Footer (Instagram, TikTok, LinkedIn, X, YouTube); each is hidden until filled in.
    - Contact email and phone: Admin -> Website -> Contact. Their starting values come from the Vercel env vars `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_CONTACT_PHONE`.
    - Terms, Privacy and the other legal texts: still the built-in placeholder wording. Once the lawyer has reviewed them, publish the real versions in Admin -> Legal.

## New questions from the build

21. **Existing packages are hidden from search** until each mentor answers the new search questions, because packages missing answers are hidden by design.
    - Decided: email your current mentors before deploying, and ask them to open My packages and Account after launch.
22. **Mentors setting call hours.** Calls are booked on the site's built-in calendar and held in private Daily rooms. Each mentor sets weekly call hours (and optionally pastes a private calendar link) on Account → Call availability, or students can't book calls.
    - Decided: send mentors a short how-to. The dashboard also shows a "Set your call hours" prompt.

## Decided (other)
- Platform fee: 30% (mentors get 70%), `PLATFORM_FEE_PERCENT` in `lib/fee.ts`.
- No discount codes or promos.
- Vetting: a rigorous interview with each senior team member; mentors are invite-only.
- Colors: Iris purple with pink and blue accents, on a white background.
- The Leland-style design is the main design.
- Payment wording: see "Hourly redesign" (the old "Payment held until you approve" line was retired with the 96-hour release). Never say "pay when you're happy".
- Admin page:
  - Invites and disputes are split into sections that open and close (Pending / Joined, Pending / Resolved).
  - "Joined" replaces "Redeemed".
  - The discount section is removed (and discount codes are gone entirely since Oct 13).
- Browse page:
  - The filters live in the left sidebar; the buttons under the search bar are removed.
  - Packages must answer the search questions.
  - Mentor-level answers (stage, school type, background) are given once on the profile.
- Calls:
  - Paid calls are booked from a package's hours (or paid per call); the free 15-minute intro call needs no payment.
  - No-shows and "a call that happened" are decided automatically from Daily's attendance (items 4 and 5).
  - Booked on MentorsMD's built-in calendar and held in private Daily rooms (Cal.com is gone).
  - No always-on video button.
