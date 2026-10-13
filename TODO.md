# MentorsMD to-do

The master to-do list now lives outside this repository (Tabo's own checklist), so it isn't repeated here. Ask Tabo for the latest version before starting work.

Status on Oct 13, 2026: all six phases are live (merged Oct 12). Bracketed numbers in commits and notes match the change list in `docs/change-list.md`.

## Working rules
- Work on a branch and open a pull request; never push to `main` (that deploys to production). Each branch gets a Vercel preview, which uses Stripe test mode and the Neon `preview` branch.
- Database changes ship as a SQL file in `prisma/`, run in the Neon SQL Editor after a Neon backup branch.
- Test on the preview first, then on the live site with the full live test in `docs/live-test.md`.
- Keep `CLAUDE.md` and `docs/` up to date when something changes.
