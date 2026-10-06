# MentorsMD: open questions (running list)

Last updated: Sept 30, 2026.

Each question has Claude's recommended answer. The new code already uses these recommendations as defaults, so the site works today. Where an answer is a number, it's a one-line constant (file noted) so changing your mind is quick. Reply "agree" or give a different answer, and the item moves to "Decided".

## Calls and scheduling

1. **Unbooked call at the deadline.**
   - Recommended (built in, `lib/callRules.ts`):
     - While a call is unbooked, the student gets a "Book your call" reminder every 3 days.
     - At the due date, if it's still unbooked, the order goes **On hold**.
       - The mentor sees: Extend due date / Message student / Ask admin.
       - The student sees: Book now / I don't need the call.
     - After 48 hours on hold:
       - If the mentor had a Cal.com page (the student could have booked), the call is **forfeited**, and the mentor can mark the work complete and get paid.
       - If the mentor had no Cal.com page, the order stays on hold for an admin to decide.
     - The mentor can never mark complete while an included call is still owed.
   - Why: this is your idea (48h warning, mentor blocked), but the outcome depends on who caused the delay, so mentors aren't punished for a student going quiet.
2. **Cancel / reschedule cutoff.**
   - Recommended (built in, `CANCEL_CUTOFF_HOURS` in `lib/calls.ts`):
     - Up to **24 hours** before the call, Reschedule and Cancel open Cal.com's own screens.
     - Inside 24 hours the buttons disappear. The page says to message the other person or contact us.
     - Set the same 24h minimum notice inside Cal.com so the two agree.
3. **When Join opens.** Recommended: **10 minutes before**, staying open until 30 minutes after the scheduled end (built in).
4. **No-shows.**
   - Recommended:
     - **Student no-show:** after waiting 15 minutes, the call counts as used. The mentor messages the student (so there's a record) and continues.
     - **Mentor no-show:** the student gets a free rebook. A second no-show on the same order lets the student open a dispute with a full refund as the expected outcome.
   - Not automated yet. Today this goes through messages and disputes. Automating it needs item 5.
5. **What counts as a call that happened.**
   - Recommended for now: a booked call whose end time has passed counts as held. That's what the code does.
   - Later: use Daily.co's meeting events (both joined for 10+ minutes) to confirm automatically. It's worth doing once no-show disputes actually come up.
6. **Book-by date.**
   - Recommended: the due date is the book-by date. Reminders are covered by item 1.
   - No separate "2 days before" deadline, because it's one more date for students to track.
7. **Calendar sync.**
   - Built:
     - Every user gets a private calendar link on Account → Calendar & calls, with one-click Google / Outlook / Apple buttons.
     - It shows their booked calls, and due dates for mentors, and updates on its own.
     - Mentors' real availability comes from Cal.com, which syncs with their own calendar.
   - Recommended: stop there. Full Google/Outlook two-way connection needs Google app verification and isn't worth it yet.

## Payments and orders

8. **Review window.** Recommended: **96 hours**, which is what the app and emails use. The old "48h" comments are outdated.
9. **Discount codes.**
   - Recommended: leave the database table and API in place for now (no cost, no risk), with no admin UI.
   - Delete them in a later cleanup once you're sure you don't want promos.
10. **Forfeited or skipped calls and payment.**
    - Recommended: **no partial refund**. The mentor held the time and delivered the rest.
    - Refunds stay a case-by-case admin call through disputes.
11. *(merged into 10)*

## Vetting

12. **How the senior team vets mentors.** Needs your answer (only you know the process). Suggested minimum:
    - Enrollment proof (student ID or school email).
    - A 20-minute interview.
    - A review of one sample of their own work (for example, their personal statement).
    - Once confirmed, the homepage "Every mentor, vetted" copy can name the steps.
13. **Acceptance rate.**
    - Needs your number. Set `MENTOR_ACCEPTANCE_RATE` in `lib/content.ts`.
    - Until then, the homepage shows "Invite-only" instead of a percentage.

## Browse and packages

14. **Service list.**
    - Recommended: keep the 8 services as they are.
    - Add "Other / custom" only if mentors ask. Every extra option makes filters weaker.
15. **Price ranges.** Recommended: keep **under $50, $50–$100, $100–$200, $200+** (built in, `PRICE_BANDS` in `lib/options.ts`). Revisit when you see real prices.
16. **Calls per package.** Recommended: **1 to 3 calls; 30, 45 or 60 minutes** (built in, `MAX_CALLS` / `CALL_LENGTHS`).

## Mentor accounts and admin

17. **Paused mentors.** Recommended: **yes, they come back automatically** on the return date (built in). No return date means they stay paused until they switch it off.
18. **Mentors who remove themselves.**
    - Recommended: they can **restore on their own** from Account (built in).
    - Mentors removed *by an admin* can't log in, and only an admin can restore them.
19. **Admin removing a mentor with active orders.**
    - Recommended: **don't auto-refund**. Removal hides the mentor and blocks login.
    - The admin then opens each active order and refunds or releases it. The admin page shows how many active orders there are when you remove someone.
    - For a mentor who left in good standing, prefer pausing them so they can finish.

## Content to supply

20. **Real content** (anything left empty is hidden, never shown as a placeholder):
    - Schools strip, testimonials and photos: `lib/content.ts`.
    - Acceptance rate: `lib/content.ts`.
    - Founder names, titles and bios: `app/founders/page.tsx`. It still has placeholder names, so please replace them before launch.
    - Contact email and phone: Vercel env vars `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_CONTACT_PHONE`.
    - Social links: not on the site yet. Send them and they'll go in the footer.
    - Terms and Privacy: still placeholder text. They need a lawyer's review before launch.

## New questions from the build

21. **Existing packages are hidden from search** until each mentor answers the new search questions, because packages missing answers are hidden by design.
    - Recommended: email your current mentors before deploying, and ask them to open My packages and Account after launch.
22. **Mentors connecting Cal.com.** Each mentor pastes their Cal.com link, plus an optional webhook so bookings show up on the order automatically.
    - Recommended: send mentors a short how-to. It's the steps on Account → Calendar & calls.

## Decided
- Colors: Iris purple with pink and blue accents, on a white background.
- The Leland-style design is the main design.
- Payment wording: "Payment held until you approve". Never say "pay when you're happy".
- Admin page:
  - Invites and disputes are split into sections that open and close (Pending / Joined, Pending / Resolved).
  - "Joined" replaces "Redeemed".
  - The discount section is removed.
- Browse page:
  - The filters live in the left sidebar; the buttons under the search bar are removed.
  - Packages must answer the search questions.
  - Mentor-level answers (stage, school type, background) are given once on the profile.
- Calls:
  - Only available once a package that includes a call has been paid for.
  - Booked through the mentor's Cal.com.
  - No always-on video button.
