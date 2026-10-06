# MentorsMD to-do

Moved here from the "MentorsMD To-Do" checklist (claude.ai artifact, Oct 5, 2026). Tick items by changing `[ ]` to `[x]`.
**Tabo** = Tabo does it. **Claude** = Claude builds it. Bracketed numbers match the change list in `docs/change-list.md`.

Status on Oct 6, 2026: Phase 1 is built but not deployed. `main` on GitHub has none of the Phase 1 changes yet (it still has `app/coaches`, `app/onboard-coach` and `app/signup/buyer`). The `mentorsmd-phase1.zip` from the Oct 1 session isn't in Downloads, so Phase 1 has to be recovered or rebuilt onto a `phase-1` branch first.

## Now: Deploy Phase 1 to a preview
- [ ] Get the Phase 1 code onto a `phase-1` branch on GitHub (**Claude**, now that the repo is connected)
- [ ] Make a Neon backup branch named `backup-before-phase-1` (**Tabo**)
- [ ] Run `prisma/phase1-2026-10.sql` in the Neon SQL Editor on main. The check query should return 3 rows (**Tabo**)
- [ ] Put the `-git-phase-1-` preview domain in the Preview-only `NEXTAUTH_URL` on Vercel, then redeploy (**Tabo**)

## Now: Test Phase 1 on the preview
Use separate browsers for the admin, mentor (a `+mentor` alias email) and student accounts. Google login and finishing payments only work on the live site.
- [ ] Addresses and wording: /coaches lands on /mentors, old links redirect, /signup/buyer opens /signup, and no "seller", "buyer" or "coach" appears anywhere [75–76] (**Tabo**)
- [ ] Package form: + Add package with no packages, asterisks, "Fill in N more", $50–$5,000 errors, 30-word counter, "Other" service [27, 53–56, 67] (**Tabo**)
- [ ] Browse: new price bands, Other filter and custom-name search, old $5 packages hidden with a banner [28–29, 68] (**Tabo**)
- [ ] Unread messages: badge in the top bar and phone menu, bold unread, clears on open, count on My orders, Messages in the mentor menu [31–34] (**Tabo**)
- [ ] Change-password pop-up ends on the success screen [57] (**Tabo**)
- [ ] Logged-in buttons, Log out, /login redirect, wrong-account invite handling, all-tab logout [61–63, 66] (**Tabo**)
- [ ] Admin 1-hour idle logout with "Still there?" at 58 minutes [64–65] (**Tabo**)
- [ ] Admin custom services list at the bottom of Admin [69] (**Tabo**)
- [ ] Send Claude anything that failed or felt awkward (**Tabo**)

## Now: Take Phase 1 live
- [ ] Merge `phase-1` into `main` and wait for the Production deployment to be Ready (**Tabo**)
- [ ] Quick live checks: Google login as a student, unread badge, one $50 payment shows Held, then refund it (**Tabo**)
- [ ] Tell current mentors about the $50 minimum (packages under $50 stay hidden until repriced) (**Tabo**)

## After Phase 1 is live: Full live test
Step-by-step instructions are in `docs/live-test.md`. Use $50 packages; the dispute test refunds the money.
- [ ] 1. First look, logged out, on phone and computer
- [ ] 2. Admin: invite yourself as a mentor
- [ ] 3. Mentor: join and set up (photo, About you, Cal.com, calendar sync, Stripe payouts)
- [ ] 4. Mentor: packages
- [ ] 5. Student: sign up and browse
- [ ] 6. Messaging both ways
- [ ] 7. Order A: pay, revise, deliver, approve, review
- [ ] 8. Order B: book a call and join it
- [ ] 9. Dispute and refund
- [ ] 10. Admin People: pause, remove, restore
- [ ] 11. Mentor pause, away date and self-remove
- [ ] 12. Accounts and passwords
- [ ] 13. Timed jobs over the next few days

## Decisions only Tabo can make
- [ ] Agree or change the recommended answers in `docs/open-questions.md` (the site already uses the recommendations)
- [ ] Describe how the senior team vets mentors (suggested: enrollment proof, 20-minute interview, one work sample)
- [ ] Give the mentor acceptance rate (`MENTOR_ACCEPTANCE_RATE` in `lib/content.ts`; until then the homepage says "Invite-only")
- [ ] Choose Vercel Pro or a free external scheduler for the 15-minute reminder job (needed for Phase 3) [73]

## Before launch: Content to supply (Tabo)
- [ ] Real founder names, titles and bios (`app/founders/page.tsx` still has placeholders)
- [ ] Real mentor photos, testimonials and the schools strip (`lib/content.ts`)
- [ ] Social media links for the footer
- [ ] Optional: contact phone number (`NEXT_PUBLIC_CONTACT_PHONE` on Vercel)
- [ ] Lawyer review of Terms and Privacy (Phase 5 adds more documents to review)

## Accounts and services (Tabo, before the phase that needs them)
- [ ] Upgrade Vercel to Pro (Hobby is non-commercial only; Pro allows frequent crons)
- [ ] Check the Daily plan includes cloud recording (Phase 3) [8]
- [ ] Create Google reCAPTCHA keys (Phase 4) [35]
- [ ] Create a free Upstash account for rate limits (Phase 4) [36]
- [ ] Create a Sentry account for error alerts [46]
- [ ] Renew the GitHub token before its 90-day expiry
- [ ] Later: upgrade Pusher at about 80 people online at once

## Phase 2: Deliveries and mentor applications (Claude)
- [ ] Delivery form when a mentor marks work complete [1]
- [ ] Delivery cards on the order page, kept across revisions [2–3]
- [ ] Admins see deliveries on disputes; delivery email includes the description [4–5]
- [ ] Mentor application form [21]
- [ ] Application emails and spam protection [22–24]
- [ ] Admin → Applications with one-click Invite [25]
- [ ] Update Become a mentor and Contact copy [26]
- [ ] Deploy and test Phase 2 (**Tabo**)

## Phase 3: Calendar, calls and reminders (Claude; replaces Cal.com)
- [ ] Private Daily rooms with meeting tokens, auto recording, attendance log, 60-day auto-delete [6–12]
- [ ] Mentor availability and student slot picker [13–14]
- [ ] On-site reschedule and cancel with the 24h rule [15]
- [ ] My calendar page, .ics invites, busy-time import from Google/iCloud [16–18]
- [ ] Busy dates and due-date rules [47–52]
- [ ] Call reminders the morning of and 1 hour before [70–74]
- [ ] Remove Cal.com links, webhook and setup steps [20]
- [ ] Deploy and test Phase 3 (**Tabo**)
- [ ] Later: one-click Google Calendar connect [19]

## Phase 4: Safety and integrity (Claude)
- [ ] reCAPTCHA, rate limits and hidden trap fields [35–36, 60]
- [ ] Email confirmation before a student's first message; new-account limits [37–38]
- [ ] Profanity filter, AI moderation, off-site warnings and link safety [39–42]
- [ ] Reserved names, staff badge, Report and Block, Guidelines and Safety pages [43–45]
- [ ] Sentry error monitoring [46]
- [ ] Admin → Flags queue, alerts, health scorecard and auto-pause [87–91]
- [ ] Ghostwriting and off-site detection, integrity banner, report reasons [92–93, 95–96]
- [ ] Mentor agreement, message-review notice in Terms, admin action log [94, 97–98]
- [ ] Deploy and test Phase 4 (**Tabo**)

## Phase 5: Legal, minors and admin team (Claude)
- [ ] Admin → Legal editor with versions [99]
- [ ] Required agreement at signup, blocking screen and acceptance records [100–103, 105]
- [ ] Date of birth at signup; under 13 can't sign up [104, 106]
- [ ] Parental consent flow for ages 13–17 [107–109]
- [ ] Under-18 badge, mentor opt-out, stricter flags, converts at 18, admin view [110–113]
- [ ] Admin → Team with Owner and Admin roles and required 2-step verification [114–118]
- [ ] Run the one-time SQL that makes Tabo's account Owner [119] (**Tabo**)
- [ ] Deploy and test Phase 5 (**Tabo**)

## Phase 6: Admin Insights (Claude)
- [ ] Overview, mentor leaderboard and breakdowns [77–79]
- [ ] Activity, funnel, student demand and student views [80–83]
- [ ] CSV download everywhere [84]
- [ ] Medical school field on mentor profiles and private activity log [85–86]
- [ ] Deploy and test Phase 6 (**Tabo**)
