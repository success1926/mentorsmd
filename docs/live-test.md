# MentorsMD test plan: hourly redesign

*Updated Oct 18, 2026 for the hourly redesign (`docs/redesign-2026-10.md`): hourly rates, free intro calls, hours, no due dates, 48 hours to respond, monthly payouts on the 24th, MentorsMD credit.*

**Who does what**

- 🛠 **Admin**: the Owner admin account (asks for your 2-step code).
- 🩺 **Mentor**: a separate account (tip: `youremail+mentor@gmail.com`).
- 🎓 **Student**: a third account (a friend, or `youremail+student@gmail.com`).

**Where:** do the money tests on the **preview** first (Stripe test mode, card `4242 4242 4242 4242`, any future date, any CVC). On the live site payments are real, and refunds are given as MentorsMD **credit**, not back to the card (if you need your own test money back, refund it in the Stripe dashboard yourself).

**Before you start:** `prisma/hourly-redesign-2026-10.sql` has been run on Supabase (live and preview). Use 3 browsers (or private windows) to stay logged in as all three. If something fails, take a screenshot, note the section, keep going.

---

## 1. 🩺 Mentor side

**Profile and offers**
- [ ] The dashboard and Account show "Finish your profile (N of 10 sections)". Until all 10 are done, you're not in Browse mentors and can't be bought from.
- [ ] Fill in: photo, credential, school; bio (40+ words); admissions experience; clinical & research; Who you're best for; 4 to 6 highlights; exactly 3 Known for; languages; fun fact; hourly rate.
- [ ] Rate & offers: set the hourly rate (try $49 and $2,001: both refused). Turn Hourly on.
- [ ] Add an hour bundle (e.g. 3 hours) and a specialized package (title, what's included, estimated hours, format, optional cover photo). Prices show as hours × rate; there's no due date, call count or typed-in price anywhere.
- [ ] Connect payouts (Dashboard → Payouts → Connect bank account). Without it, the dashboard says "Connect payouts".
- [ ] Set call hours on Account → Call availability.

**Working on a package** (after the student buys, section 2)
- [ ] You get the "New package" email. The package shows under Active packages on the dashboard.
- [ ] The package page shows hours used / left, calls held, earned so far, next payout (the 24th).
- [ ] Log written work: 30 or 60 minutes, a note, optional file. You can't log more than the hours left. The student gets "Written time logged".
- [ ] When the package gets down to 1 hour left: you get "1 hour left (mentor)" (once), the hours bar turns amber with a "Running low" tag (dashboard, Inbox, package page), and the package page tells you the student was reminded and to message them if more hours are needed.
- [ ] After a call is held, it appears in the hours log automatically (30 or 60 minutes). You can watch its recording on the package page (students can't).
- [ ] "Mark work complete" is blocked while a call is still booked; otherwise it works any time. The student gets "Work marked complete" with the 48-hour deadline.
- [ ] If the student asks for one last call or revision, you get an email; deliver it and mark complete again.

**Getting paid**
- [ ] Dashboard: "Earned this month (not yet paid)" goes up as hours are logged (70% of each hour), "Next payout" shows the 24th, and "Past payouts" is empty until the first payout.
- [ ] After a payout (section 3), the dashboard and Dashboard → Payouts list it, and you get "Monthly payout sent".

## 2. 🎓 Student side

**Before buying**
- [ ] On a mentor's profile, every Buy button says "Message or book an intro call to unlock".
- [ ] Book the free 15-minute intro call (pop-up on the profile). Both get "Intro call booked" with a calendar invite; reminders arrive on the day and 1 hour before. You can only book one per mentor.
- [ ] After the mentor replies to your message (or the intro call is held), Buy unlocks.

**Buying and using hours**
- [ ] Details pop-up shows hours, format, "Due date: none", the price math. Buy → Stripe → back to the package page. You get "You're set" (package bought).
- [ ] With MentorsMD credit (give yourself some in section 3), checkout shows "Credit applied". If credit covers everything, there's no Stripe page.
- [ ] Book a 30- or 60-minute call from your hours (no payment). Both get "Call booked" with an invite. Booked calls count against hours left. Cancel or reschedule works until 24 hours before.
- [ ] Add hours (1, 2, 3 or 5) at the package's rate → Stripe → "Hours added" email, hours left goes up.
- [ ] When 1 hour is left, you get "1 hour left" (once), and the hours bar turns amber with a "Running low" tag (dashboard, My packages, package page). After adding hours it goes back to normal.
- [ ] With no hours left, picking a time on the mentor's calendar offers a pay-per-call (30 or 60 minutes at the hourly rate).
- [ ] Messages and shared files on the package page belong to that package. My packages shows Active / Waiting on you / Completed, and your credit balance.

**Finishing**
- [ ] After "Mark work complete", the package page shows the 48-hour banner: Approve, Request one last call, Request one last revision, Open a dispute.
- [ ] Ask for one last revision: the banner goes away; after the mentor marks complete again, only Approve / Dispute are left.
- [ ] Approve: both get "Package approved". Leave a review.
- [ ] On another package, do nothing for 48 hours: it's approved automatically (both get the email, saying "automatically").
- [ ] Open a dispute on an active package (Report a problem). You can reply in the dispute thread.

## 3. 🛠 Admin side

**Orders & payouts**
- [ ] The cards show Sales (packages + added hours), Paid with credit, Collected by card, fee, Paid to mentors, Not yet paid out, Credit issued, Credit students still have. They match what you did.
- [ ] Paid packages lists each one with kind, hours used / left, added hours, credit applied and a status (Active, Waiting on student, Disputed, Approved waiting for payout, Paid to mentor, Refunded as credit). Open shows the package page with a "For admins" box. CSV downloads work.
- [ ] Monthly payouts: as Owner, press **Run payouts now**. The mentor gets one payout for the latest month: hours logged plus unused hours of approved packages, at 70%. A row appears with the amount, status Paid and the Stripe transfer id (check it in Stripe → Transfers). Approved packages it covered show Paid to mentor.
- [ ] Press Run payouts now again: nobody is paid twice ("already paid this month").
- [ ] A mentor without connected payouts is listed as skipped.
- [ ] Hours on a disputed package are not in the payout; the mentor's dashboard shows them as held.
- [ ] (Preview) Make a payout fail (e.g. a test mentor whose Stripe account isn't finished): it shows Failed with the error, the sidebar badge counts it, and Retry sends it once fixed.
- [ ] On the 24th, the cron runs the payouts by itself (Vercel → Cron jobs shows `/api/cron/monthly-payouts`).

**Disputes**
- [ ] The open dispute shows hours used / left, added hours, credit used, and says the hours are held from the payout.
- [ ] **Refund as credit**, partial (e.g. $20): the student gets "MentorsMD credit added", the package is approved and closed, and the mentor's next payout for it is the unpaid and unused hours minus $20.
- [ ] **Refund as credit**, full (the default amount): the package shows Refunded as credit, its calls are cancelled, and nothing more is paid to the mentor.
- [ ] **Approve for the mentor** settles a dispute in the mentor's favour (paid with the next payout).
- [ ] Resolved disputes show how each was settled. The Disputes & flags badge only counts open ones.

**People, calls, insights, emails**
- [ ] People → a student → MentorsMD credit: balance and history. Add $10 with a reason: the student is emailed (without the reason), the Action log has it. Removing more than the balance is refused. Without the Orders permission you can see it but not change it.
- [ ] Calls & recordings lists intro calls too (badge INTRO, no package link) next to package calls.
- [ ] Insights → Overview: Money collected includes added hours and is net of credit; Credit issued shows. Breakdowns has "By offer kind" (no turnaround). CSV downloads work.
- [ ] Admin → Emails lists the new emails (package bought, new package, hours added, 1 hour left (student and mentor), call booked, written time logged, work marked complete, one last call or revision, package approved, intro call booked / reminder, monthly payout sent, MentorsMD credit added), each editable with a preview. The old due-date, overdue, on-hold, "book your call", forfeited, delivered (96 hours), released and revision emails are gone from the list.

## 4. Anyone

- [ ] Public pages (homepage, how it works, become a mentor, browse) no longer mention due dates, turnaround or the 96-hour release.
- [ ] Vercel → Cron jobs shows four: call-reminders (every 15 minutes), monthly-payouts (24th), recordings-cleanup (daily), safety (daily).
