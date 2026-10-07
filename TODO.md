# MentorsMD to-do

Moved here from the "MentorsMD To-Do" checklist (claude.ai artifact, Oct 5, 2026). Tick items by changing `[ ]` to `[x]`.
**Tabo** = Tabo does it. **Claude** = Claude builds it. Bracketed numbers match the change list in `docs/change-list.md`.

Status on Oct 7, 2026: all six phases are built, each as its own pull request stacked on the one before: Phase 1 #4, Phase 2 #6, Phase 3 #7, Phase 4 #8, Phase 5 #9, Phase 6 #10. Each has its own Vercel preview (`mentorsmd-git-phase-N-mentors-md-marketplace.vercel.app`). None is live yet. Take them live in order, one at a time; the full click-by-click checklist is `docs/phase-checklist.md`.

## Now: Deploy Phase 1 to a preview
- [x] Get the Phase 1 code onto a `phase-1` branch on GitHub (**Claude**, Oct 6)
- [x] Make a Neon backup branch named `backup-before-phase-1` (**Claude**, Oct 7)
- [x] Run `prisma/phase1-2026-10.sql` on the production database (**Claude**, Oct 7; 3 columns confirmed)
- [x] Set a `phase-1`-only Preview `NEXTAUTH_URL` on Vercel and redeploy (**Claude**, Oct 7)

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

## After all phases are live: Full live test
Step-by-step instructions are in `docs/live-test.md`. Use $50 packages; the dispute test refunds the money.
- [ ] 1. First look, logged out, on phone and computer
- [ ] 2. Admin: invite yourself as a mentor
- [ ] 3. Mentor: join and set up (photo, About you, medical school, call hours, calendar sync, Stripe payouts)
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
- [ ] Choose Vercel Pro or a free external scheduler (cron-job.org) for `/api/cron/call-reminders` every 15 minutes (needed for Phase 3) [73]

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
- [ ] Optional: create a free Upstash account for rate limits (Phase 4 falls back to the database) [36]
- [ ] Optional: Anthropic API key (AI message checks) and Google Safe Browsing key (link checks) (Phase 4) [40, 42]
- [ ] Set `DAILY_API_KEY` and `DAILY_WEBHOOK_SECRET` in Vercel (Phase 3; video calls need them) [6–12]
- [ ] Authenticator app on your phone for admin 2-step login (Phase 5) [116]
- [ ] Optional: create a Sentry account for error alerts (Phase 4 works without it) [46]
- [ ] Renew the GitHub token before its 90-day expiry
- [ ] Later: upgrade Pusher at about 80 people online at once

## Phase 2: Deliveries and mentor applications (Claude)
- [x] Delivery form when a mentor marks work complete [1] (built Oct 7)
- [x] Delivery cards on the order page, kept across revisions [2–3] (built Oct 7)
- [x] Admins see deliveries on disputes; delivery email includes the description [4–5] (built Oct 7)
- [x] Mentor application form [21] (built Oct 7)
- [x] Application emails and spam protection [22–24] (built Oct 7)
- [x] Admin → Applications with one-click Invite [25] (built Oct 7)
- [x] Update Become a mentor and Contact copy [26] (built Oct 7)
- [ ] Run `prisma/phase2-2026-10.sql` after a Neon backup, test the preview, then merge PR #6 (**Tabo**; steps in `docs/phase-checklist.md`)

## Phase 3: Calendar, calls and reminders (Claude; replaces Cal.com)
- [x] Private Daily rooms with meeting tokens, auto recording, attendance log, 60-day auto-delete [6–12] (built Oct 7)
- [x] Mentor availability and student slot picker [13–14] (built Oct 7)
- [x] On-site reschedule and cancel with the 24h rule [15] (built Oct 7)
- [x] My calendar page, .ics invites, busy-time import from Google/iCloud [16–18] (built Oct 7)
- [x] Busy dates and due-date rules [47–52] (built Oct 7)
- [x] Call reminders the morning of and 1 hour before [70–74] (built Oct 7)
- [x] Remove Cal.com links, webhook and setup steps [20] (built Oct 7)
- [ ] Run `prisma/phase3-2026-10.sql` after a Neon backup, test the preview, then merge PR #7 (**Tabo**; steps in `docs/phase-checklist.md`)
- [ ] Later: one-click Google Calendar connect [19]

## Phase 4: Safety and integrity (Claude)
- [x] reCAPTCHA, rate limits and hidden trap fields [35–36, 60] (built Oct 7)
- [x] Email confirmation before a student's first message; new-account limits [37–38] (built Oct 7)
- [x] Profanity filter, AI moderation, off-site warnings and link safety [39–42] (built Oct 7)
- [x] Reserved names, staff badge, Report and Block, Guidelines and Safety pages [43–45] (built Oct 7)
- [x] Sentry error monitoring [46] (built Oct 7)
- [x] Admin → Flags queue, alerts, health scorecard and auto-pause [87–91] (built Oct 7)
- [x] Ghostwriting and off-site detection, integrity banner, report reasons [92–93, 95–96] (built Oct 7)
- [x] Mentor agreement, message-review notice in Terms, admin action log [94, 97–98] (built Oct 7)
- [ ] Run `prisma/phase4-2026-10.sql` after a Neon backup, test the preview, then merge PR #8 (**Tabo**; steps in `docs/phase-checklist.md`)

## Phase 5: Legal, minors and admin team (Claude)
- [x] Admin → Legal editor with versions [99] (built Oct 7)
- [x] Required agreement at signup, blocking screen and acceptance records [100–103, 105] (built Oct 7)
- [x] Date of birth at signup; under 13 can't sign up [104, 106] (built Oct 7)
- [x] Parental consent flow for ages 13–17 [107–109] (built Oct 7)
- [x] Under-18 badge, mentor opt-out, stricter flags, converts at 18, admin view [110–113] (built Oct 7)
- [x] Admin → Team with Owner and Admin roles and required 2-step verification [114–118] (built Oct 7)
- [ ] Run the one-time SQL that makes Tabo's account Owner [119] (**Tabo**)
- [ ] Run `prisma/phase5-2026-10.sql` after a Neon backup, test the preview, then merge PR #9 (**Tabo**; steps in `docs/phase-checklist.md`)

## Phase 6: Admin Insights (Claude)
- [x] Overview, mentor leaderboard and breakdowns [77–79] (built Oct 7)
- [x] Activity, funnel, student demand and student views [80–83] (built Oct 7)
- [x] CSV download everywhere [84] (built Oct 7)
- [x] Medical school field on mentor profiles and private activity log [85–86] (built Oct 7)
- [ ] Run `prisma/phase6-2026-10.sql` after a Neon backup, test the preview, then merge PR #10 (**Tabo**; steps in `docs/phase-checklist.md`)
