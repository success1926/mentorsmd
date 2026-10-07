# Taking phases 1–6 live: what to check

All six phases are built. Each one is a pull request that sits on top of the one before it:

| Phase | What it adds | Pull request | Preview |
|---|---|---|---|
| 1 | Wording, prices, unread messages, logins | #4 | mentorsmd-git-phase-1-mentors-md-marketplace.vercel.app |
| 2 | Deliveries and mentor applications | #6 | mentorsmd-git-phase-2-mentors-md-marketplace.vercel.app |
| 3 | Built-in calendar, private video calls, reminders (Cal.com removed) | #7 | mentorsmd-git-phase-3-mentors-md-marketplace.vercel.app |
| 4 | Safety: email confirmation, spam limits, message checks, Flags | #8 | mentorsmd-git-phase-4-mentors-md-marketplace.vercel.app |
| 5 | Legal documents, students under 18, admin team and 2-step login | #9 | mentorsmd-git-phase-5-mentors-md-marketplace.vercel.app |
| 6 | Admin Insights, medical school, private activity log | #10 | mentorsmd-git-phase-6-mentors-md-marketplace.vercel.app |

## The routine for each phase, in order 1 → 6

1. **Back up.** In Neon, make a branch named `backup-before-phase-N`. Claude can do this for you.
2. **Database update.** Run `prisma/phaseN-2026-10.sql` in the Neon SQL Editor. Every update only adds things, so the live site keeps working. Claude can run it once you say OK. Phase 1's is already done.
3. **Test the preview** using the checks below. Logging in on a preview needs a preview-only `NEXTAUTH_URL` for that branch. Claude sets this up. Google login and real payments only work on the live site.
4. **Merge** the pull request on GitHub, then wait until the Vercel Production deployment shows Ready. Phase N+1's pull request then switches to point at `main` by itself.
5. Tell Claude anything that broke or felt awkward, and Claude fixes it on that phase's branch.

Use three browsers (or private windows): one for admin, one for a mentor (a `+mentor` email alias), one for a student.

## Keys and accounts to set up first

| What | Where | Needed for | If missing |
|---|---|---|---|
| A scheduler that runs `/api/cron/call-reminders` every 15 minutes | Vercel Pro, or free cron-job.org | Phase 3 one-hour call reminders | The morning-of reminder still goes out; the 1-hour reminder doesn't |
| `DAILY_API_KEY` | Daily.co dashboard → Developers | Phase 3 video calls | The Join button can't open a room |
| `DAILY_WEBHOOK_SECRET` | Admin → "Connect Daily webhook" shows it | Phase 3/4 attendance and recordings | Attendance events are refused |
| `DAILY_RECORDING_ENABLED=true` | Only if your Daily plan includes recording | Phase 3 recordings | Calls aren't recorded |
| A verified Resend domain for `success@mentorsmd.com` | Resend → Domains | Phase 2 application emails, every other email | Emails fail to send |
| `APPLICATIONS_EMAIL` (optional) | Vercel env vars | Phase 2: where applications go | Defaults to success@mentorsmd.com |
| reCAPTCHA v3 keys (optional) | google.com/recaptcha/admin | Phase 4 bot protection | Skipped |
| Upstash Redis (optional) | upstash.com | Phase 4 rate limits | Uses the database instead |
| `ANTHROPIC_API_KEY` (optional) | console.anthropic.com | Phase 4 AI message checks | Skipped |
| `GOOGLE_SAFE_BROWSING_KEY` (optional) | Google Cloud | Phase 4 unsafe-link checks | Skipped |
| `SENTRY_DSN` (optional) | sentry.io | Phase 4 error alerts | Skipped |
| An authenticator app on your phone | Google Authenticator, 1Password, etc. | Phase 5 admin login (email codes also work) | — |

Also check that your Vercel plan allows 3 daily crons, because Phase 4 adds a third.

## Phase 1 (#4)
- /coaches goes to /mentors, /signup/buyer opens /signup, and the words "seller", "buyer" and "coach" don't appear anywhere.
- Package form: asterisks show on required fields, "Fill in N more" appears, prices outside $50–$5,000 are refused, the 30-word counter works, and the "Other" service is available.
- Browse: the new price bands and the Other filter work, and old $5 packages are hidden with a banner.
- Unread messages: a badge shows in the top bar and phone menu, and it clears when you open the conversation.
- The change-password pop-up ends on a success screen. Log out works in every tab.
- Admin logs out after 1 hour idle, with a "Still there?" warning at 58 minutes.

## Phase 2 (#6): deliveries and mentor applications
- Mentor: Mark complete opens a form. Deliver stays off until the note has 20 characters.
- Mentor: send 2 files with a note. A Delivery card appears and the files download.
- Student: Approve, Revision and Dispute show under the card.
- Student: the "ready for review" email shows the note and the file names.
- Ask for a revision and deliver again: the page shows "Deliveries (2)", the new one has a Latest badge, and Delivery 1 is still there.
- A package with an unbooked call still can't be marked complete.
- Open a dispute: Admin → Disputes shows "What the mentor delivered".
- Become a mentor → Apply. The word counter turns red past 100 words. A .png or a resume over 5 MB is refused. Submitting shows a thank-you page.
- The team inbox gets the application with the resume attached. The applicant gets a confirmation email.
- A third application from the same email within a day says "We already have your application".
- Admin → Mentor applications: download the resume, click Invite, and the invite email goes out. Decline and "Move back to pending" also work.

## Phase 3 (#7): calendar, calls, reminders
- Mentor dashboard shows "Set your call hours". On Account, set your call hours and save them, and set your time zone.
- Add busy dates. You get a clash warning, plus an email if they clash with a due date.
- Paste a Google "secret iCal" link: your busy times are hidden from students.
- Package form: the turnaround text shows.
- Checkout shows the earliest date, crosses out busy days, and shows the recording notice.
- Book a call: both sides get emails with a calendar (.ics) attachment.
- Reschedule and cancel work more than 24 hours ahead. Inside 24 hours the buttons are hidden.
- /calls/… keeps Join switched off until 10 minutes before the call, then opens a private room. [DAILY_API_KEY]
- A third account opening the call link sees "Call not found".
- Admin → "Connect Daily webhook", then attendance shows after a call. [DAILY_API_KEY] Only admins can open "Watch recording". [paid Daily plan]
- /calendar shows calls and due dates.
- Reminders arrive at 8am and again 1 hour before the call. [scheduler]

## Phase 4 (#8): safety
- Sign up as a student and receive the confirmation email. Messaging a mentor asks you to confirm your email first.
- The name "Admin" is refused at signup. 6 or more wrong logins in a row gives "too many attempts".
- A phone number or "text me on WhatsApp" shows a warning, and "Send anyway" still sends. A bit.ly link is blocked.
- Clicking a normal link opens the "leaving MentorsMD" screen. The integrity banner shows at the top of every conversation.
- Report a message and block someone. The blocked person can't message you.
- Mentor join and saving a package both need the agreement checkbox.
- Admin → Flags lists reports and disputes, and its buttons work. A high-severity flag emails the admins.
- Pause and unpause someone in People. Health badges show. The action log lists all of the above.
- Uphold 3 flags on one test account: it pauses itself.
- With keys only: [reCAPTCHA] the badge shows; [Anthropic] "write my essay for me" creates an AI flag; [Safe Browsing] a test-unsafe link is blocked; [Sentry] errors appear in Sentry.

## Phase 5 (#9): legal, under 18, admin team
Right after running `prisma/phase5-2026-10.sql`, open `prisma/phase5-make-owner-2026-10.sql` in the Neon SQL Editor. Put your login email in both places, then run it. Don't save your email in the repo file.
- Your next admin login asks you to set up 2-step verification. Scan the QR code. Every login after that asks for a code.
- Admin → Legal: publish version 1 of the Terms. A student then gets a "Please review our terms" screen until they accept.
- Version 2 published as "Minor change" shows no screen. Version 3 published as "Everyone must accept again" shows the screen with "What changed".
- /terms shows the published version. Acceptance records show IP and browser, and Download CSV works.
- Signup asks for a date of birth and the agreement box. Under 13 is refused. An existing student is asked for their date of birth once.
- Sign up aged 15 with a parent email you control. A "waiting for your parent" banner shows, and messaging is refused.
- The parent opens the email link, ticks the box, types their name and clicks "I consent". The student can now message.
- The mentor sees an "Under 18" badge and a warning line. A phone number from that student creates a high-severity flag.
- The parent gets a receipt when the student pays. The parent page lists the order. "Withdraw consent" pauses the student.
- A mentor who switches off "Students under 18" can't be messaged or booked by minors.
- Admin → Under 18 shows the signature record.
- Team: invite a test admin. They set a password and 2-step login. Disabling them logs them out on their next click.
- You can't demote yourself while you're the only Owner.

## Phase 6 (#10): Insights and medical school
- The mentor application's medical school field suggests schools as you type. The join page has it filled in already, and it's required.
- An existing mentor without a school sees "Add your medical school" on the dashboard. The school shows on their profile and card and can be searched.
- In a private window, open the site with `?utm_source=instagram`. View a mentor, search "mcat", then sign up. Admin → Insights → Activity log shows all four, and the student's Signup source says "instagram".
- A search with no results shows under Student demand. A profile you view while logged in as admin isn't logged.
- Overview: the numbers change when you switch the date range, and bars show their values on hover.
- The leaderboard sorts and filters. The 7 breakdown tables, the Activity tab, and the site and per-mentor funnels all show.
- A paid test order shows in Overview, and refunding it raises Refunds. [Stripe test mode]
- Every CSV button downloads a working spreadsheet, including People and the Action log.

## After everything is live
- Email current mentors. They need to:
  - answer the search questions on each package (packages without answers stay hidden)
  - set their call hours
  - add their medical school
  - reprice anything under $50
- Have a lawyer review the Terms, Privacy, Mentor Agreement, Community Guidelines and Parental Consent texts, then publish them in Admin → Legal.
- Run the full live test in `docs/live-test.md`. Step 3 now means setting call hours, not Cal.com.
- Optional: add `?utm_source=instagram` (or tiktok, newsletter) to links you post, so signups show where they came from.
