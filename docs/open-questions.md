# MentorsMD: open questions (running list)

Last updated: Oct 14, 2026. All six phases are live (merged Oct 12).

On Oct 14, 2026 the owner confirmed every recommended answer, so every item below is now **Decided** and the code uses it. Where an answer is a number, it's a one-line constant (file noted) so changing your mind later is quick. New questions go at the end as "Open".

## Calls and scheduling

1. **Unbooked call at the deadline.** Students book calls on the site's built-in calendar from the mentor's call hours.
   - Decided (built in, `lib/callRules.ts`):
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
     - **Second mentor no-show on the same order:** the student's email and the order page say they can **open a dispute, with a full refund as the expected outcome** (the order page has an "Open a dispute for a full refund" box), and a **high-severity** flag goes to every admin.
     - **Nobody joined** (or it's unclear, e.g. both very late): it doesn't count either way. Both get an email saying the team will be in touch, and a flag asks an admin to decide.
   - Admin -> Calls & recordings shows each past call's outcome (automatic or set by an admin) and buttons to change it: Count as held, Give a free rebook, Mark student no-show, Mark mentor no-show (needs the Calls permission; every change is in the Action log). The two no-show buttons send the same emails; "Count as held" and "Give a free rebook" send nothing, so tell the people yourself.
   - The order page shows each past call's outcome in plain words. The mentor still can't mark the work complete while a call is owed, including a free rebook, a call being checked, or a call waiting for an admin's decision.
   - Emails (editable in Admin -> Emails): `call_student_no_show_student`, `call_student_no_show_mentor`, `call_mentor_no_show_student`, `call_mentor_no_show_mentor`, `call_nobody_joined`.
5. **What counts as a call that happened.** Decided, and built (Oct 14, 2026):
   - A call counts as held when the student and mentor were both in it for 10+ minutes, using Daily's join/leave events (the Daily webhook, Admin -> Calls & recordings -> "Connect Daily webhook").
   - If the webhook isn't set up (no `DAILY_WEBHOOK_SECRET`) and there's no attendance, the old rule applies: once the end time has passed, the call counts as held. If the webhook is set up but nothing arrived, it's "nobody joined".
   - Calls that ended more than 48 hours ago without an outcome (from before this was built) count as held, as before.
6. **Book-by date.**
   - Decided: the due date is the book-by date. Reminders are covered by item 1.
   - No separate "2 days before" deadline, because it's one more date for students to track.
7. **Calendar sync.**
   - Built:
     - Every user gets a private calendar link on Account → Calendar & calls, with one-click Google / Outlook / Apple buttons.
     - It shows their booked calls, and due dates for mentors, and updates on its own.
     - Mentors set weekly call hours and busy dates on the site (Account → Call availability), and can paste a private Google/iCloud calendar link so their busy times are hidden from students.
   - Decided: stop there. Full Google/Outlook two-way connection needs Google app verification and isn't worth it yet.

## Payments and orders

8. **Review window.** Decided: **96 hours**, which is what the app and emails use. The old "48h" comments are outdated.
9. **Discount codes.** Decided: **no promos**. Discount codes were removed completely on Oct 13, 2026: the code and admin API are gone, and the database table is dropped with `prisma/cleanup-2026-10-drop-discount-codes.sql` once that change is live.
10. **Forfeited or skipped calls and payment.**
    - Decided: **no partial refund**. The mentor held the time and delivered the rest.
    - Refunds stay a case-by-case admin call through disputes.
11. *(merged into 10)*

## Vetting

12. **How the senior team vets mentors.** Decided: every mentor has a rigorous interview with each senior team member. Mentors are invite-only.
13. **Acceptance rate.** Decided: **not shown**. Mentors are invite-only, so there's no application rate to quote. The setting was removed (Oct 14, 2026) and the homepage always says "Invite-only".

## Browse and packages

14. **Service list.** Decided: the 8 services plus **"Other"** (built in): a mentor picking Other types a short custom service name, which shows everywhere in place of the word "Other" and can be searched.
15. **Price ranges.** Decided, built in: **$50–$100, $100–$250, $250–$500, $500+** (`PRICE_BANDS` in `lib/options.ts`). Revisit when you see real prices.
16. **Calls per package.** Decided: **1 to 3 calls; 30, 45 or 60 minutes** (built in, `MAX_CALLS` / `CALL_LENGTHS`).

## Mentor accounts and admin

17. **Paused mentors.** Decided: **yes, they come back automatically** on the return date (built in). No return date means they stay paused until they switch it off.
18. **Mentors who remove themselves.**
    - Decided: they can **restore on their own** from Account (built in).
    - Mentors removed *by an admin* can't log in, and only an admin can restore them.
19. **Admin removing a mentor with active orders.**
    - Decided: **don't auto-refund**. Removal hides the mentor and blocks login.
    - The admin then opens each active order and refunds or releases it. The admin page shows how many active orders there are when you remove someone.
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
- Payment wording: "Payment held until you approve". Never say "pay when you're happy".
- Admin page:
  - Invites and disputes are split into sections that open and close (Pending / Joined, Pending / Resolved).
  - "Joined" replaces "Redeemed".
  - The discount section is removed (and discount codes are gone entirely since Oct 13).
- Browse page:
  - The filters live in the left sidebar; the buttons under the search bar are removed.
  - Packages must answer the search questions.
  - Mentor-level answers (stage, school type, background) are given once on the profile.
- Calls:
  - Only available once a package that includes a call has been paid for.
  - No-shows and "a call that happened" are decided automatically from Daily's attendance (items 4 and 5).
  - Booked on MentorsMD's built-in calendar and held in private Daily rooms (Cal.com is gone).
  - No always-on video button.
