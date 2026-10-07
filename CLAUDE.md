# MentorsMD

A freelance marketplace for getting into medical school. Students book packages (written feedback or live calls) from mentors who are vetted by the MentorsMD senior team. The owner is Tabo, who is not a developer: explain steps in plain language and do as much of the work as possible yourself.

**Start here:** `TODO.md` is the master to-do list. Keep it up to date when items are finished.

## Docs
- `docs/change-list.md`: the numbered change list (items 1–119), grouped into Phases 1–6. TODO.md and commits refer to these numbers.
- `docs/open-questions.md`: product rules with the recommended answers the code already uses.
- `docs/live-test.md`: the full live test, section by section.
- `docs/design-direction.md`: design decisions. The Leland-style design (joinleland.com) is the main design, always in the Iris colors.

## Stack and services
Next.js 14 (App Router) + TypeScript, Prisma on Neon Postgres, NextAuth (email and Google login), Stripe (Checkout + Connect payouts, 20% platform fee, payment held until the student approves), Resend (email), Pusher (live messages), Vercel Blob (uploads), Daily (video calls), Cal.com (scheduling; to be replaced by a built-in calendar in Phase 3). Hosted on Vercel; crons are in `vercel.json`.

## Conventions
- Visible wording says "mentor" and "student" (never seller, buyer or coach), even though some database fields still use the old names.
- Pages: `/mentors` (was `/coaches`), `/become-a-mentor/join` (was `/onboard-coach`), `/signup` (was `/signup/buyer`).
- Package prices are $50–$5,000. Payment wording: "Payment held until you approve". Never "pay when you're happy".
- Pushing to `main` deploys to production on Vercel. Do work on a branch and open a pull request; each branch gets a Vercel preview.
- Database changes ship as a SQL file in `prisma/` that Tabo runs in the Neon SQL Editor, after making a Neon backup branch.
- This repository is public: never commit secrets, real customer data or personal email addresses.
