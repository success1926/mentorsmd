# MentorsMD change list (Oct 1, 2026)

Collected from a Q&A session with Tabo. Status: **Phase 1 built (Oct 1, 2026), awaiting deploy/test.** Phases: 1 quick wins · 2 deliveries + applications · 3 calendar/calls/reminders · 4 safety · 5 legal/minors/admin team · 6 insights.

Phase 1 covered items 27–34, 53–57, 61–69, 75–76 (code on local branch `phase-1`, shipped as mentorsmd-phase1.zip; SQL prisma/phase1-2026-10.sql). Deviation: Admin → Custom services section added at the bottom of Admin (item 69). Cal.com fields still present until Phase 3.
Repo: github.com/success1926/mentorsmd

## Deliveries
1. Mark complete opens a delivery form: required description (min length), optional multi-file upload.
2. Delivery card on the order page; Approve / Revision / Dispute sit under it.
3. Keep every delivery (Delivery 1, 2…) across revisions.
4. Admins see deliveries on disputed orders.
5. "Work delivered" email includes the description.

## Video calls (Daily)
6. Calls always use our Daily rooms (no Cal.com/Zoom/Meet links).
7. Private rooms with per-person meeting tokens.
8. Auto cloud recording.
9. Recording notice at booking, order page, pre-join, Terms/Privacy.
10. Recordings admin-only ("Watch recording").
11. Attendance log per call (join/leave times), shown on order + admin.
12. Recordings auto-delete 60 days after release/dispute resolution.

## Built-in calendar (Cal.com removed completely)
13. Mentor availability: weekly hours, time zone, buffer, minimum notice, days off.
14. Student slot picker on the order page; booking creates the Daily room.
15. On-site reschedule/cancel with 24h rule + emails.
16. "My calendar" page for mentors and students.
17. .ics invite emails on book/reschedule/cancel; subscribe feed stays.
18. Mentors paste Google/iCloud secret address to block busy times.
19. Later: Google Calendar one-click connect (after Google verification).
20. Remove Cal.com link, webhook, setup steps.
47. Busy dates: ranges + private note; "no deadlines" or "no deadlines and no calls".
48. Checkout date picker greys out busy dates; server enforces.
49. Minimum due date = turnaround (48h→2d, 3–5d→5d, 1–2wk→14d, scheduled call→2d), skipping busy dates; picker opens on earliest date with explanation.
50. Revision 7-day due-date push skips busy dates.
51. Warning when busy dates clash with existing deadlines.
52. Turnaround changes apply to new orders only.
70. Morning-of call reminder (both, local time zone).
71. 1-hour-before reminder with Join link.
72. Reminders sent once, reset on reschedule, skipped if cancelled.
73. Reminder job every 15 min (Vercel Pro or free external scheduler).
74. Time zone stored on every account (auto-detected, editable).

## Mentor applications
21. Application form: name, medical school, residency (optional), email, phone, resume (PDF/Word ≤5MB), 100-word blurb (min ~20) with counter.
22. Email to success@mentorsmd.com with resume attached, reply-to applicant.
23. Applicant confirmation email + thank-you screen.
24. Spam protection on form.
25. Admin → Applications (Pending/Invited/Declined, resume download, one-click Invite).
26. Update Become a mentor + Contact page copy.

## Packages
27. Price limits $50–$5,000 (form, server, checkout).
28. Out-of-range existing packages hidden until updated, with banner.
29. Browse price bands: $50–100, $100–250, $250–500, $500+.
30. Update live-test checklist to $50.
53. Top bar shows "+ Add package" with no packages, "My packages" otherwise.
54. Permanent "+ Add package" button on My packages and Dashboard.
55. Required-field feedback (asterisks, "Fill in X more", red outlines, instant price errors).
56. 30-word minimum description.
67. "Other" service with required 3–40 char name shown as the tag; goes live immediately.
68. "Other" filter + search on custom names.
69. Admin list of custom service names.

## Messages
31. Unread badge on Messages (top bar + phone menu).
32. Unread conversations bold with dot; opening marks read.
33. Messages in mentor account menu.
34. "X unread messages" on student My orders.

## Safety and anti-abuse
35. reCAPTCHA (Tabo chose reCAPTCHA over Turnstile) on signup, login, forgot password, mentor application.
36. Rate limits (signup, login, messages, uploads, applications).
37. Email confirmation before student's first message.
38. New-account limit ~5 new mentor conversations/day.
39. Profanity/slur filter with medical allow-list (block slurs/threats, allow mild swearing, flag borderline).
40. AI moderation check → admin flags.
41. Off-site payment/contact warnings + flags.
42. Link safety (Safe Browsing, block shorteners, leaving-site screen, no links from <1-day accounts).
43. Reserved names + official staff badge.
44. Report + Block buttons; Admin → Reports.
45. Community Guidelines + Safety tips pages.
46. Sentry.
60. Hidden trap fields on all public forms.

## Account and login
57. Change password in a pop-up with a success confirmation screen.
61. Logged-in users see role buttons instead of Get started / Create account; footer shows Log out.
62. Signup/login redirect logged-in users; invite links handle wrong account.
63. More visible Log out.
64. Sessions: 7 days idle / 30 days max (students, mentors); 1 hour idle for admins with warning.
65. "Logged out due to inactivity" + return to page.
66. Log out signs out all tabs.

## Wording
75. "Mentor" and "student" everywhere visible (pages, errors, emails).
76. URLs: /coaches→/mentors, /onboard-coach→/become-a-mentor/join, /signup/buyer→/signup, with redirects.

## Admin Insights
77. Overview (sales, fee, payouts, refunds, AOV, new users, charts, date range).
78. Mentor leaderboard (sortable; filters by school, MD/DO, stage, service).
79. Breakdowns by school, MD/DO, stage, service, format, price band, turnaround.
80. Activity (active users, messages, calls, no-shows, quiet mentors).
81. Funnel (site-wide and per mentor).
82. Student demand (top searches/filters, zero-result searches).
83. Students (top spenders, repeat rate, signup source).
84. CSV download everywhere.
85. Medical school field on mentor profiles (picker; carried from applications; existing mentors prompted).
86. Private activity log (profile views, searches, signup source).

## Flags and integrity
87. Admin → Flags unified queue (disputes, reports, auto flags) by severity, evidence highlighted, Dismiss/Warn/Pause/Remove.
88. Instant email for high severity + weekly digest.
89. Health scorecard + flag history; badges in People.
90. 3 upheld flags in 90 days → auto-pause pending review.
91. Performance flags: slow replies (>24h avg / 48h unanswered), 2+ overdue in 60d, no-shows, 3+ late cancels in 60d, >25% revision/dispute/refund, rating <3.5 or any 1-star, no login 14d.
92. Ghostwriting detection: phrases, AI review, essay-with-no-draft check; credential requests always high.
93. Off-site detection: contact info, outside meeting links, payment apps, contact info in files, went-quiet pattern, low conversion.
94. Mentor agreement at signup and on packages (dated).
95. Integrity banner in conversations.
96. Student report reasons for ghostwriting/off-site.
97. Terms/Privacy cover message review.
98. Admin action log.

## Legal / Terms
99. Admin → Legal editor (Terms, Privacy, Mentor Agreement, Community Guidelines, Parental Consent), versions, minor vs must-re-accept.
100. Required agreement checkbox at student signup (email and Google).
101. Blocking screen until accepted.
102. Acceptance records (version, time, IP, browser), admin view + CSV.
103. Requirement switches on when v1 is published.
104. Date of birth at signup (age gate).
105. Mentors accept Mentor Agreement + Terms at onboarding.

## Minors (13–17)
106. Under 13 can't sign up.
107. 13–17: parent/guardian name, email, phone required; account pending until parent consents.
108. Parent consent page: reads Terms + Parental Consent form, types full name as e-signature; recorded. Reminders; link expires in 7 days.
109. Parent gets order receipts and can see order/call history via a parent link; can withdraw consent.
110. "Under 18" badge visible to mentors; mentors can opt out of working with minors.
111. Stricter flags for minors: any off-site contact is high severity.
112. Account converts to adult at 18.
113. Admin view of minor accounts and consent records.

## Admin team
114. Admin → Team: invite admins by email; invitee sets own password.
115. Roles: Owner (Tabo) and Admin; only Owners manage the team; can't remove last Owner.
116. Required 2-step verification for admins (authenticator app or email code).
117. Remove/disable an admin instantly (sessions revoked).
118. Admin action log covers team changes.
119. One-time SQL step makes Tabo's existing account Owner.
