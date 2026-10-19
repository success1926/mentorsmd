# MentorsMD redesign (October 2026): hourly pricing, hours, intro calls

Agreed with the owner on Oct 18, 2026. The visual reference is the owner's mockup
(10 screens); this file is the source of truth for behaviour. Build it in three
parts on branch `hourly-redesign` (one PR at the end). There are no real
customers yet (all test users were deleted), so old orders do not need to keep
working, but the database change must be additive (new tables/columns, nothing
dropped) and every page must still build.

## 1. Unlocking a mentor

- A student can always **message** a mentor, and can always **book one free
  15-minute intro call** with a mentor (no message needed first). One intro
  call per student–mentor pair. Intro calls use the existing booking calendar,
  private Daily room, recording and attendance, but have no order and no
  payment, and never count as hours.
- Buying anything from a mentor is **unlocked** once EITHER the mentor has
  replied to the student in their conversation OR the student's intro call with
  that mentor has happened (held, per the call-outcome logic). Until then every
  Buy button reads "Message or book an intro call to unlock".
- Under-18 rules, blocks, safety checks and agreement checkboxes still apply.

## 2. Mentor profile (required before listing)

A mentor is hidden from Browse mentors / search, and cannot be bought from,
until ALL of these are filled in (show a "Finish your profile" checklist on the
dashboard and Account page, with progress "N of 10 sections"):

1. Photo; one-line credential; medical school, stage and school type (already exist).
2. **Bio** paragraph (the existing `bio` field), 3–4 sentences (enforce a sensible minimum, e.g. 40 words).
3. **Admissions experience**: list of roles (committee / interviewer / screener, years, "former" flag), years advising (number), approximate applicants supported (number), strongest stages (≥1 of: school list, personal statement, activities, secondaries, interview prep, waitlist/update letters).
4. **Clinical & research**: specialty interest (text), research interests and accomplishments (3–4 sentences).
5. **Who you're best for** (≥1 of: Traditional MD, DO, MD-PhD, Nontraditional / career changers, Reapplicants, Low GPA / upward trend, International, BS/MD, Residency / ERAS; plus optional "Other" text). This **replaces** the old `backgrounds` search filter everywhere (browse filters, search, insights).
6. **Credentials & highlights**: 4–6 bullets (MCAT/USMLE percentile is just optional content).
7. **Known for**: exactly 3 short bullets.
8. **Languages**: ≥1, each with proficiency (Native / Fluent / Conversational) and "can advise" yes/no.
9. **Fun fact**: 1–2 sentences.
10. Hourly rate set (≥ $50).

Public profile (student view), one page:
- Left: photo, name, credential, the bio paragraph, chips for "Best for" and languages the mentor can advise in. "Read full bio" expands the other sections as bullet lists inline, in a box that scrolls on its own (max ~320px), staying in the left column.
- Top right: a box with **Book free 15-min intro call** and **Message**.
- **Packages (N)**: a horizontal, scroll-snapping row of specialized-package cards (optional cover photo behind the title with a dark fade). The "Packages (N)" heading opens a pop-up listing all packages; choosing one shows its details with a "← All packages" back button.
- Under that: **Hourly** card (rate, Buy 1 hour) and **Hour bundles** list (Buy each).
- Then **Reviews** (average, count, cards showing which package was bought).
- Every Details / Buy / intro-call booking / message action opens as a **pop-up on the profile page**, never a new page. Details pop-up: description, hours, format, "Due date: none", price math, how hours work, then either Buy → Stripe Checkout, or (locked) Book intro call / Message.

## 3. Pricing and offers (mentor side)

- Each mentor sets one **hourly rate** (min $50, whole dollars).
- Offer types:
  - **Hourly**: 1 hour at the hourly rate. On/off; usable for calls, written work or both.
  - **Hour bundles**: N hours (e.g. 3, 5, 10); each bundle can set its own per-hour rate (defaults to the hourly rate, min $50). Price = hours × rate.
  - **Specialized packages**: title, what's included, estimated hours, format (calls only / written only / calls + written), optional per-hour rate (defaults to hourly, min $50), optional cover photo (Supabase Storage public-media, with focus point like the website editor). Price = estimated hours × rate.
- Remove from the package form: due dates / delivery days, number of calls, call length, typed-in prices, the $50–$5,000 per-package price band (prices now come from rate × hours; keep the browse price-band filter working off the computed price).
- Changing a rate never changes what an existing order paid.

## 4. Orders and hours

- Buying anything creates an **order** (a "package" in the UI) with: hours purchased (store minutes), the per-hour rate paid, price, kind (HOURLY / BUNDLE / SPECIALIZED / PAY_PER_CALL), format, and the package snapshot (title, description). **No due date.** Old due-date / overdue / on-hold / forfeit / "book your call" logic and emails are removed for new orders (old fields may stay in the schema unused).
- **Hours log** per order, visible to student and mentor: entries of type CALL or WRITTEN, length **30 or 60 minutes**, date, note, who logged it. Calls add an entry automatically when the call is held (use the booked length: 30 or 60). Written work is logged by the mentor in 30/60-minute blocks with a note and optional file. A mentor cannot log beyond the hours left.
- **Booking calls from hours**: on the order page (and from Messages / My packages / dashboard), the student picks a 30- or 60-minute slot on the mentor's calendar; no Stripe while enough hours remain. The booked time is reserved against hours left; a cancelled/rescheduled call (≥24h before) frees it; a mentor no-show gives the time back (keep existing no-show rules).
- **Top-ups**: students can **add hours** to an active order anytime (choose 1/2/3/5 hours) at that order's per-hour rate → Stripe Checkout → hours added. Remind the student by email when 1 hour is left.
- **Out of hours**: picking a time on the mentor's calendar with no hours left (or with no order) and after unlocking → a **pay-per-call order** (30 or 60 minutes at the mentor's hourly rate) paid via Stripe Checkout, then the call is booked. Over-estimate on a specialized package = the student adds hours.
- Counters shown to both sides: hours used / left, calls held, calls recorded.
- **Recordings**: mentors can watch recordings of their own calls (in their package workspace); admins as today. Students do not see recordings. 60-day deletion after the order closes stays.

## 5. Finishing an order

- The mentor clicks **Mark work complete** (any time). The student then has **48 hours** to: **Approve**, **Request one last call**, **Request one last revision**, or **Open a dispute**. No response = auto-approved after 48 h (cron).
- One last call / one last revision can each be used once per order; after the mentor delivers it and marks complete again, the student gets a fresh 48 h with only Approve / Dispute.
- **Unused hours are not refunded**; they're paid to the mentor when the order is approved.
- **Disputes are the only route for problems**; an admin decides (as today). Any refund an admin grants is issued as **MentorsMD credit**, never money back to the card.

## 6. MentorsMD credit

- A per-student credit balance (ledger table: amount in cents, reason, order, admin, timestamp). Credit can be spent with **any mentor** and **never expires**.
- At checkout, available credit is applied first automatically (show "Credit applied: $X"); if credit covers everything, no Stripe page; otherwise Stripe charges the rest.
- Shown on the student dashboard and in Admin (People → student → credit, with manual adjust + reason, logged in the action log).
- Admin dispute resolution: "Refund as credit" (full or partial amount) replaces card refunds for new orders.

## 7. Paying mentors (monthly)

- Students pay MentorsMD (Stripe Checkout, money stays in our balance, as today: separate charges and transfers).
- Mentors earn **70%** of each hour (30% fee, `lib/fee.ts`).
- **Monthly payout**: on the **24th** of each month a cron totals, per mentor, everything not yet paid: hours logged/held up to that moment, plus the unused hours of orders approved by then. One Stripe transfer per mentor per month to their connected account (`MentorPayout` record: period, amount, entries included, transfer id, status; idempotent; failures flagged to admins with "[NEEDS MANUAL CHECK]" like today).
- Hours in an order under dispute are held back until the dispute is decided.
- Mentor dashboard: "Earned this month / next payout on the 24th / past payouts". Admin → Orders & payouts: monthly payout list and a "Run payouts now" button for the owner.

## 8. Messages and files per order

- Every order has its own message thread and **shared files** (PDF/Word up to 10 MB, existing private storage). Simplest: keep one Conversation per student–mentor and tag messages/attachments with the order they belong to (nullable `orderId`); the order page shows that order's thread + files; general (pre-purchase) messages have no order.
- **Student Messages page** (`/messages`): left list of every mentor conversation (avatar, name, last message, time, unread dot, context label: "<package> · N h left", "No package yet · intro call booked <day>", "Waiting for a reply"); search; right the thread with **Book a call** and **Package · files** buttons; composer with attach. Top bar "Messages" with unread count (exists; keep).
- **Student My packages page** (`/orders`): same two-pane layout: left list with filters Active / Waiting on you / Completed (title, mentor, hours left bar, status badge e.g. "Respond in 41 h", new-message count); right the selected package summary (48 h banner if relevant, hours left, calls held, shared files count, Message · share a file / Book a call / Add hours, recent activity) and "Open full package page".
- **Student dashboard**: a card per active package (hours left, new messages, latest message, Message · share a file / Book a call / Open package), "Coming up" calls, credit balance.
- **Student package page** (`/orders/[id]`): 48 h decision banner when marked complete; hours meter (calls vs written, calls held/recorded); book a call from hours (30/60); "Running low? Add hours"; messages + shared files; hours log.
- **Mentor package workspace** (mentor's order page): totals (hours used/left, calls held, earned, next payout), log written work, recordings list, messages + shared files, Mark work complete.

## 9. Emails (editable templates, `lib/emailTemplates.ts`)

Add/adjust: intro call booked (both), intro call reminder, purchase confirmed (student) / new order (mentor), hours added, 1 hour left (student and mentor), call booked from hours (both, with .ics), written time logged (student), work marked complete (student, 48 h), last call/revision requested (mentor), auto-approved / approved (both), monthly payout sent (mentor), credit issued (student). Remove due-date/overdue/on-hold/forfeit/book-your-call emails from the active set.

## 10. Admin

- Orders & payouts: new order kinds, hours used/left, monthly payouts list, run payouts now (owner).
- Disputes: refund as credit (full/partial), hold hours from payout while open.
- People: student credit balance + adjust; mentor profile completeness.
- Insights: keep working (revenue = money collected; add credit issued).

## 11. Not changing

30% fee, Stripe Connect payouts to mentors, Daily rooms/recording/attendance/no-show outcomes, 24-hour reschedule/cancel cutoff, reminders, under-18 consent, safety/AI/link checks, reCAPTCHA, website editor, legal versions, admin roles, PostHog, Sentry.
