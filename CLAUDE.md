# MentorsMD

A freelance marketplace for getting into medical school. Students book packages (written feedback or live calls) from mentors who are vetted by the MentorsMD senior team. The owner is Tabo, who is not a developer: explain steps in plain language and do as much of the work as possible yourself.

**Status (Oct 13, 2026):** all six phases are live (merged Oct 12). The master to-do list now lives outside the repo; `TODO.md` only says where it is and lists a few working rules.

## Docs
- `docs/change-list.md`: the numbered change list (items 1–119), grouped into Phases 1–6 (all live). Commits refer to these numbers.
- `docs/open-questions.md`: product rules with the recommended answers the code already uses.
- `docs/live-test.md`: the full live test, section by section.
- `docs/phase-checklist.md`: how Phases 1–6 were taken live (kept for reference).
- `docs/design-direction.md`: design decisions. The Leland-style design (joinleland.com) is the main design, always in the Iris colors.

## Stack and services
Next.js 14 (App Router) + TypeScript, Prisma on Neon Postgres, NextAuth (email and Google login), Stripe (Checkout + Connect payouts, 30% platform fee so mentors get 70% (`lib/fee.ts`), payment held until the student approves), Resend (email), Pusher (live messages), Vercel Blob (uploads), Daily (private video call rooms), Google reCAPTCHA v3 (bot protection). Scheduling is the site's own built-in calendar (call hours, slot picker, reminders); Cal.com is gone. Hosted on Vercel; crons are in `vercel.json`.

## Environments
- **Production** (mentorsmd.com): Stripe in live mode (real payments), reCAPTCHA on, Neon branch `production`.
- **Previews** (one per branch): Stripe in test mode, their own Neon branch named `preview`. Links and logins use the preview's own address (`lib/siteUrl.ts`), so `NEXTAUTH_URL` should be set for Production only.
- The Owner admin account exists and uses 2-step login. All test users were cleared on Oct 13, 2026.
- Mentors are invite-only. Vetting copy: a rigorous interview with each senior team member.

## Conventions
- Visible wording says "mentor" and "student" (never seller, buyer or coach), even though some database fields still use the old names.
- Pages: `/mentors` (was `/coaches`), `/become-a-mentor/join` (was `/onboard-coach`), `/signup` (was `/signup/buyer`).
- Package prices are $50–$5,000. No discount codes or promos (removed Oct 13, 2026). Payment wording: "Payment held until you approve". Never "pay when you're happy".
- Pushing to `main` deploys to production on Vercel. Do work on a branch and open a pull request; each branch gets a Vercel preview.
- Database changes ship as a SQL file in `prisma/`, run in the Neon SQL Editor after making a Neon backup branch. Files that only add things run before the code goes live; files that remove things run after.
- Build links to the site with `siteUrl()` from `lib/siteUrl.ts`, never `process.env.NEXTAUTH_URL` directly.
- This repository is public: never commit secrets, real customer data or personal email addresses.
- Automatic emails: wording lives in `lib/emailTemplates.ts` (defaults) and Admin -> Emails (saved edits, `EmailTemplate` table). Send through a template in `lib/email.ts`, never with raw HTML; every send attempt is in Admin -> Email log (`EmailLog`, kept 90 days).
