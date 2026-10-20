# Load test

`load.js` simulates many people using MentorsMD at once: landing on the home page, browsing
mentors, opening mentor profiles and other public pages, and sending the waitlist and contact
forms. It runs with [k6](https://k6.io), a free load-testing tool: `brew install k6`.

## Quick check (safe on the live site)

```bash
k6 run -e BASE_URL=https://www.mentorsmd.com scripts/loadtest/load.js
```

This is the `smoke` profile: 5 visitors and 2 form-fillers for 30 seconds. The forms are sent
with the hidden spam-trap field filled in, so the site answers "ok" and saves nothing.
The only trace it leaves is a few rows in the Browse search log (Admin → Reports), because every
visit to /mentors is logged.

## Profiles

| `PROFILE` | Visitors browsing | Filling out forms | Length |
| --- | --- | --- | --- |
| `smoke` (default) | 5 | 2 | 30 s |
| `launch` | ramps to 200 | ramps to 20 | 8 min |
| `spike` | 1,000 within 30 s | 100 | 3 min |

Each simulated visitor pauses to read between clicks, so 200 visitors is roughly 200 real people
on the site at the same moment.

**Run `launch` and `spike` against a preview deployment, not mentorsmd.com.** Vercel's attack
protection can treat a burst from one computer as an attack and block it, the run counts toward
Vercel usage, and the search log would fill with test visits. Previews use the separate `preview`
schema in Supabase, so they don't touch live data. They sit behind Vercel sign-in: create a bypass
secret in Vercel → Project → Settings → Deployment Protection → **Protection Bypass for Automation**
and pass it as `BYPASS`:

```bash
k6 run -e BASE_URL=https://<preview>.vercel.app -e BYPASS=<secret> -e PROFILE=launch scripts/loadtest/load.js
```

## What it doesn't cover

Logged-in pages (dashboards, messages, booking, checkout) and video calls aren't in this test:
they need test accounts, and checkout uses live Stripe on the main site.

## Reading the results

k6 prints a summary at the end. The three lines that matter:

- `http_req_failed`: share of requests that errored. The test fails above 1%.
- `http_req_duration{kind:page}`: `p(95)` is how long 95% of page loads took. The target is under 1.5 s.
- `http_req_duration{kind:form}`: the same for form submissions. The target is under 3 s.

A ✗ next to a check (e.g. `/mentors loads`) means some of those requests didn't succeed.
Vercel → Logs for that deployment shows why.
