# MentorsMD

A freelance marketplace for getting into medical school. Students book packages (written feedback or live calls) from mentors who are vetted by the MentorsMD senior team. The owner is Tabo, who is not a developer: explain steps in plain language and do as much of the work as possible yourself.

**Status (Oct 13, 2026):** all six phases are live (merged Oct 12). The master to-do list now lives outside the repo; `TODO.md` only says where it is and lists a few working rules.

## Docs
- `docs/change-list.md`: the numbered change list (items 1–119), grouped into Phases 1–6 (all live). Commits refer to these numbers.
- `docs/open-questions.md`: product rules (all decided as of Oct 14, 2026) and what the code does for each.
- `docs/live-test.md`: the live test plan for the hourly redesign (mentor, student and admin side).
- `docs/redesign-2026-10.md`: the hourly-pricing redesign spec (Oct 2026), the source of truth for packages, hours, credit and payouts.
- `docs/phase-checklist.md`: how Phases 1–6 were taken live (kept for reference).
- `docs/design-direction.md`: design decisions. The Leland-style design (joinleland.com) is the main design, always in the Iris colors.

## Stack and services
Next.js 14 (App Router) + TypeScript, Prisma on Neon Postgres, NextAuth (email and Google login), Stripe (Checkout + Connect, separate charges and transfers; 30% platform fee so mentors get 70% (`lib/fee.ts`); mentors are paid once a month, on the 24th, by `/api/cron/monthly-payouts` (`lib/payouts.ts`)), Resend (email), Supabase Realtime (live messages, `lib/realtime.ts`), Supabase Storage (uploads, `lib/storage.ts`), Daily (private video call rooms), Google reCAPTCHA v3 (bot protection). Scheduling is the site's own built-in calendar (call hours, slot picker, reminders); Cal.com is gone. Hosted on Vercel; crons are in `vercel.json`.

## Environments
- **Production** (mentorsmd.com): Stripe in live mode (real payments), reCAPTCHA on, Neon branch `production`.
- **Previews** (one per branch): Stripe in test mode, their own Neon branch named `preview`. Links and logins use the preview's own address (`lib/siteUrl.ts`), so `NEXTAUTH_URL` should be set for Production only.
- The Owner admin account exists and uses 2-step login. All test users were cleared on Oct 13, 2026.
- Mentors are invite-only. Vetting copy: a rigorous interview with each senior team member.

## Conventions
- Visible wording says "mentor" and "student" (never seller, buyer or coach), even though some database fields still use the old names.
- Pages: `/mentors` (was `/coaches`), `/become-a-mentor/join` (was `/onboard-coach`), `/signup` (was `/signup/buyer`).
- Hourly pricing (redesign Oct 2026, `docs/redesign-2026-10.md`): each mentor sets an hourly rate ($50–$2,000); offers are Hourly, hour bundles and specialized packages priced hours x rate. No due dates. The student has 48 hours to respond after "Mark work complete". Refunds are only ever MentorsMD credit (`lib/credit.ts`, `lib/creditAdmin.ts`), never back to the card. No discount codes or promos (removed Oct 13, 2026). Never say "pay when you're happy".
- Orders since the redesign have a `kind`: `IN_ESCROW` = active, `COMPLETED` = approved and waiting for the monthly payout, `RELEASED` = paid to the mentor, `REFUNDED` = refunded in full as credit. Payout rules: `lib/payoutRules.ts` (pure) and `lib/payouts.ts`.
- Crons (`vercel.json`): call reminders + call outcomes + 48-hour auto-approval every 15 minutes, monthly payouts on the 24th (14:00 UTC), recordings cleanup and safety checks daily.
- Pushing to `main` deploys to production on Vercel. Do work on a branch and open a pull request; each branch gets a Vercel preview.
- Database changes ship as a SQL file in `prisma/`, run in the Neon SQL Editor after making a Neon backup branch. Files that only add things run before the code goes live; files that remove things run after.
- Mentor area (mentor area v2, Oct 2026): every mentor page has the mentor sidebar (`components/MentorShell.tsx`, links in `lib/mentorNav.ts`; mentors get it on `/dashboard/*`, `/messages`, `/orders`, `/calendar` through `components/MentorArea.tsx`). Pages: Home `/dashboard`, Students & packages `/dashboard/students`, Calendar & availability `/dashboard/availability`, My profile `/dashboard/profile` (the 10 steps), Rates & packages `/dashboard/packages`, Payouts, Settings `/dashboard/settings`. `/account` is students/admins only; mentors are redirected (old `/account#anchor` links map to the new pages). Mentors preview their public profile at `/mentors/<id>?preview=1` (action buttons switched off).
- Admin: one page per area under `app/admin/(panel)/`, listed in the sidebar from `lib/adminNav.ts` (adding a page is one line). Each area has a permission key (`lib/adminPermissions.ts`); Owner and Admin have all of them, custom roles (Admin -> Team & roles) only the ticked ones. Every admin page's `layout.tsx` and every `/api/admin` route checks its key on the server with `currentAdmin("key")` (`lib/adminTeam.ts`); money (earnings, refunds, releases) needs `orders`.
- Build links to the site with `siteUrl()` from `lib/siteUrl.ts`, never `process.env.NEXTAUTH_URL` directly.
- Public page text and photos (homepage, how it works, reviews, senior team, become a mentor, mentors intro, contact, footer) are edited in Admin -> Website (`/admin/website`): draft, preview, publish. Fields and their built-in defaults live in `lib/siteContent.ts`; loading/caching in `lib/siteContentStore.ts`; stored in the `SiteContent` table (`prisma/website-editor-2026-10.sql`). When changing copy in code, change the default there.
- Files: Supabase Storage (`lib/storage.ts`). Private files (attachments, deliveries, résumés) store their path and are downloaded through a route that checks access; photos go in the public `public-media` bucket. Paths start with `live/` or `preview/` (`ENV_TAG` in `lib/supabase.ts`) because previews share the same Supabase project. Old Vercel Blob addresses (anything starting with `http`) still work.
- Live updates: Supabase Realtime (`lib/realtime.ts`, `lib/realtimeClient.ts`). The server sends each event to every recipient's own private topic (`live:user:<id>` / `preview:user:<id>`); browsers only listen. Buckets and the Realtime rule: `prisma/supabase-storage-realtime-2026-10.sql` (already applied).
- This repository is public: never commit secrets, real customer data or personal email addresses.
- Automatic emails: wording lives in `lib/emailTemplates.ts` (defaults) and Admin -> Emails (saved edits, `EmailTemplate` table). Send through a template in `lib/email.ts`, never with raw HTML; every send attempt is in Admin -> Email log (`EmailLog`, kept 90 days).
- Visitor analytics: PostHog (`components/PostHogAnalytics.tsx`, in the root layout), on only when `NEXT_PUBLIC_POSTHOG_KEY` is set (Production only). Logged-in people are identified by user id and role only; admins are opted out; inputs are masked; session recordings run only on public marketing pages for logged-out visitors; tokens and non-utm query strings are stripped before sending. Mark anything private (like message threads) with the `ph-no-capture` class. Admin -> Analytics (`/admin/analytics`, permission `analytics`) reads the numbers with HogQL through `lib/posthog.ts` (cached 5 minutes). The first-party visit log (`components/Tracker.tsx`, `/api/track`, Insights) is separate and unchanged.
- Leads (Admin -> Leads, `/admin/leads`, permission `leads`): mentor applications (`MentorApplication`), Contact page messages and "Tell me when mentors join" waitlist signups (both in the `Lead` table), each with a status, an assignee (admins only) and internal notes (`LeadNote`); CSV per tab. `/admin/applications` redirects there for anyone with `leads`. The Waitlist tab's "Email everyone" button sends `waitlist_mentors_available` in small batches with a signed "remove me" link (`/waitlist/remove`). Code: `lib/leads.ts`, `lib/leadOptions.ts`, `lib/leadQueries.ts`; SQL: `prisma/leads-2026-10.sql`.
