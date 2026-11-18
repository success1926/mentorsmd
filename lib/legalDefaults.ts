import { MENTOR_AGREEMENT_POINTS } from "@/lib/agreement";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { RESPONSE_WINDOW_HOURS } from "@/lib/finishing";
import { CANCEL_CUTOFF_HOURS, RECORDING_RETENTION_DAYS } from "@/lib/calls";
import { NO_SHOW_WAIT_MINUTES } from "@/lib/callOutcomes";
import { PAYOUT_DAY } from "@/lib/payoutRules";
import type { LegalKind } from "@/lib/legalKinds";

// The built-in text of each legal document, shown until a version is
// published in Admin -> Legal ("version 0"). Starting a draft in Admin ->
// Legal copies this text, so the reviewed version can be edited there and
// published (which asks everyone to accept it again).
//
// Drafted Nov 18, 2026 to match how the site works (fee, payouts, credit-only
// refunds decided by an admin, the 48-hour window, calls and recordings).
// Still to be reviewed by a lawyer before it's published as version 1, in
// particular governing law (the state isn't named yet), liability and
// disputes. The numbers come from the code, so they stay in step with it.
//
// Format (components/LegalBody.tsx): "## " heading, "- " bullet, blank line
// between paragraphs. No HTML.

const EFFECTIVE = "Effective November 18, 2026";
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "success@mentorsmd.com";

const TERMS = `${EFFECTIVE}

These Terms of Service ("Terms") are an agreement between you and MentorsMD LLC ("MentorsMD", "we", "us"). They cover your use of mentorsmd.com, the MentorsMD app and everything we offer through them (together, the "Service"). By creating an account, buying anything or using the Service, you agree to these Terms, our Privacy Policy and our Community Guidelines. If you don't agree, please don't use the Service.

## 1. What MentorsMD is
MentorsMD is a marketplace that connects people applying to medical school ("students") with mentors such as medical students, residents, BS/MD undergraduates and gap-year students ("mentors") for one-on-one help: feedback on written work, mock interviews, advising calls and similar services.
- Mentors join only by application, an interview with our senior team and an invitation. Vetting a mentor is not a guarantee of any particular result.
- Mentors are independent contractors. They are not employees, agents or representatives of MentorsMD, and they decide how they deliver their own services within these Terms and the Mentor Agreement.
- MentorsMD is not a medical school, an admissions committee or a licensed counselor, and is not affiliated with or endorsed by the AAMC, AACOM, TMDSAS or any medical school.
- We don't promise admission, interview invitations, test scores or any other outcome. Admissions decisions are made only by schools.

## 2. Who can use MentorsMD
- You must be at least 13 years old.
- Students aged 13 to 17 need a parent or legal guardian to complete our Parental Consent form before they can message mentors or book. The parent or guardian agrees to these Terms on the student's behalf.
- You must give accurate information, keep it up to date, and keep your password and sign-in codes private. You're responsible for everything done through your account. Tell us right away at ${CONTACT} if you think someone else has used it.
- One person, one account. You may not use the Service if we have removed you before.

## 3. Messages and free intro calls
Students can message mentors for free and book a free 15-minute intro call. A student can buy from a mentor once that mentor has replied or the intro call has happened. Keep all conversations, calls and files on MentorsMD.

## 4. Buying hours and packages
- Mentors set their own hourly rate. Students buy time with a mentor as hours, hour bundles or a specialized package, priced at the hours multiplied by the mentor's hourly rate. The price is shown before you pay.
- You pay MentorsMD, not the mentor, when you buy. Card payments are processed by Stripe. Prices are in US dollars.
- Calls and written work are logged against the hours you bought, in blocks of 30 or 60 minutes, on your package page.
- Specialized packages are priced on an estimate of the hours the work takes. If the work is finished in fewer hours, the unused hours are not refunded.
- Any MentorsMD credit in your account is used first at checkout.

## 5. Calls, rescheduling and no-shows
- Calls take place in a private MentorsMD video room that only the student, the mentor on the order and the MentorsMD team can enter.
- You can cancel or reschedule a call on the site until ${CANCEL_CUTOFF_HOURS} hours before it starts. Within ${CANCEL_CUTOFF_HOURS} hours, a reschedule needs a written reason, which is shared with the other person.
- If the mentor is in the call and the student hasn't joined within ${NO_SHOW_WAIT_MINUTES} minutes of the start time, the call counts as used.
- If the student is in the call and the mentor hasn't joined within ${NO_SHOW_WAIT_MINUTES} minutes, the student can book that call again at no cost. If it happens twice on the same order, the student can open a dispute.
- Calls may be recorded for safety and quality. Only the mentor on the call and the MentorsMD team can watch a recording, and the team only does so when there is a problem with an order (for example a dispute or a missed call). Recordings are deleted ${RECORDING_RETENTION_DAYS} days after the order is closed. By joining a call you agree to this.

## 6. Finishing the work
When your mentor marks the work complete, you have ${RESPONSE_WINDOW_HOURS} hours to approve it, ask for one last call or one last revision (once per order), or open a dispute. If you don't respond within ${RESPONSE_WINDOW_HOURS} hours, the work is approved automatically. Once work is approved, the mentor is paid for it and it can no longer be disputed.

## 7. Refunds, disputes and MentorsMD credit
- If something goes wrong with an order, report a problem or open a dispute from the order before the work is approved. Payment to the mentor for that order is paused while we look into it.
- A MentorsMD admin reviews what happened, which may include the messages, files, call logs and recordings for that order, and decides whether a refund is due and how much. We aim to be fair to both sides, and the admin's decision on a dispute is final within MentorsMD.
- Refunds are given only as MentorsMD credit, never back to your card or bank account, except where the law requires otherwise.
- MentorsMD credit can be used with any mentor and never expires. It has no cash value, can't be transferred or sold, and is lost if you delete your account. Gift credit bought for a student follows the same rules.
- If you dispute a charge with your bank or card company instead of using our dispute process, we may pause your account while it's resolved.

## 8. Gifts and purchases by parents
A parent, guardian or anyone else may buy MentorsMD credit or a specific package for a student without an account. The buyer gets a receipt and a private page showing the gift, and the student receives the credit or package in their own account. Buying a gift is not the same as giving parental consent: students under 18 still need consent before they can use the Service.

## 9. Rules for everyone
You agree to follow the Community Guidelines. In particular, you won't:
- ask a mentor to write any part of an application, or to take a test for you, or, as a mentor, offer to do either;
- pay or ask for payment outside MentorsMD, or move a conversation, call or file sharing off the site to get around MentorsMD;
- ask for or share passwords or login details (AMCAS, AACOMAS, TMDSAS, email or any other account);
- harass, threaten or discriminate against anyone, or send sexual or otherwise inappropriate content;
- share another person's application materials, recordings or personal information without permission;
- misrepresent who you are, your training or your results;
- copy, scrape, reverse engineer or interfere with the Service, or use it for anything illegal.

## 10. Safety checks
To keep MentorsMD safe and honest, messages, file names, package descriptions and delivery notes are checked automatically (including by an AI service) for things like threats, slurs, payment outside MentorsMD, ghostwriting and requests for passwords. Messages with slurs or threats may not be delivered. When something is flagged or reported, the MentorsMD team may read the conversation and the files involved. Students under 18 get the extra protections described in the Parental Consent form.

## 11. Your content
- You keep ownership of what you upload or write, such as essays, drafts, messages and feedback ("your content").
- You give MentorsMD a limited license to store, process, display and transmit your content only as needed to run, secure and improve the Service, to handle disputes and safety reviews, and to meet legal obligations.
- Students may use the feedback and materials a mentor gives them for their own applications. Mentors may not reuse or share a student's materials.
- Reviews you post may be shown on mentor profiles and elsewhere on MentorsMD with your first name and last initial.
- The MentorsMD name, logo, site design and our own text belong to MentorsMD.

## 12. Suspension and closing accounts
You can delete your account at any time in Settings; the Delete Your Account page explains what is deleted and what is kept. We may warn, pause, limit or close an account, remove content, or cancel an order if we reasonably believe someone has broken these Terms or the Community Guidelines, put others at risk, or acted fraudulently. Where we can, we'll tell you why. Sections 7, 11 and 13 to 18 continue to apply after an account is closed.

## 13. Disclaimers
The Service is provided "as is" and "as available". Mentors are responsible for their own advice and services. To the fullest extent the law allows, MentorsMD makes no warranties of any kind about the Service or any mentor, express or implied, including fitness for a particular purpose, and doesn't guarantee that the Service will be uninterrupted or error-free.

## 14. Limits on our liability
To the fullest extent the law allows, MentorsMD and its owners, staff and contractors are not liable for any indirect, incidental, special, consequential or punitive damages, or for lost opportunities, admissions outcomes, profits or data, arising from your use of the Service or from any mentor's or student's conduct. Our total liability for any claim relating to the Service is limited to the greater of the amount you paid MentorsMD in the 12 months before the claim arose and $100. Some places don't allow these limits, so they may not all apply to you.

## 15. Indemnity
If your use of the Service, your content or your breach of these Terms leads to a claim against MentorsMD by someone else, you agree to cover the reasonable costs MentorsMD incurs because of it, including legal fees, to the extent the law allows.

## 16. Resolving problems and governing law
Please contact us first at ${CONTACT}; most problems can be solved quickly. If we can't resolve a disagreement informally within 30 days, either side may take it to the state or federal courts located in the state where MentorsMD LLC is organized, and both sides agree to those courts' jurisdiction. These Terms are governed by the laws of that state and of the United States, without regard to conflict-of-law rules. Either side may instead bring a claim in small-claims court if it qualifies.

## 17. Changes to these Terms
We may update these Terms as the Service changes. For a significant change, we'll post the new version on the site and ask you to accept it the next time you sign in; other changes take effect when they're posted. If you don't agree to a change, you can stop using the Service and delete your account.

## 18. Other terms
These Terms, together with the Privacy Policy, the Community Guidelines and, for mentors, the Mentor Agreement, are the whole agreement between you and MentorsMD about the Service. If any part is found unenforceable, the rest still applies. If we don't enforce a part right away, we haven't given it up. You may not transfer your account or these Terms; we may transfer them as part of a merger, sale or reorganization.

## 19. Contact
MentorsMD LLC · ${CONTACT} · or use our contact page.`;

const PRIVACY = `${EFFECTIVE}

This Privacy Policy explains what information MentorsMD LLC ("MentorsMD", "we", "us") collects when you use mentorsmd.com and the MentorsMD app (the "Service"), how we use and share it, and the choices you have. We don't sell your personal information and we don't show ads.

## 1. Information you give us
- Account details: name, email address, password (stored scrambled, never in plain text), date of birth, and whether you're a student or mentor.
- Profile details: for mentors, training, schools, rates, bio, photo and résumé; for students, anything you choose to add on About You.
- What you send through the Service: messages, files, essays and drafts, delivery notes, reviews, reports and contact-form messages.
- Parental consent: for students aged 13 to 17, the parent or guardian's name, email address and typed signature.
- Mentor applications: the details and résumé you submit.
- Payments and payouts: card details go directly to Stripe and never reach our servers. We keep records of what was bought, paid, refunded as credit and paid out. Mentors give their tax and bank details to Stripe, not to us.

## 2. Information collected automatically
- Usage: pages visited, mentor profiles viewed, searches on Browse Mentors, and how you first found us (for example the website that linked to us). We use two of our own cookies for this (a random browser id and the first-visit source), and these entries are deleted after about 13 months.
- Sign-in: cookies that keep you logged in, and a scrambled (hashed) version of your IP address, not the address itself, to limit spam and abuse.
- Calls: when each person joined and left a call, and recordings (see section 4).
- Error reports: when something breaks, the page address (with private links and ids removed) and the kind of error, never what you typed.

## 3. How we use information
- To run the Service: accounts, messages, bookings, calls, payments, credit and mentor payouts.
- To send emails you need, such as sign-in codes, receipts, call reminders and updates on your orders.
- To keep the Service safe: automatic safety checks, reviewing reports and disputes, preventing fraud and spam, and protecting students under 18.
- To understand and improve the Service, using the analytics described below.
- To meet legal, tax and accounting obligations, and to enforce our Terms.

We don't use your messages, essays or files to train AI models.

## 4. Calls, recordings and calendars
Calls run on Daily.co in private rooms. Calls may be recorded. Recordings are stored by Daily.co, can be watched only by the mentor on the call and by the MentorsMD team when there is a problem with an order, and are deleted ${RECORDING_RETENTION_DAYS} days after the order is closed. We store your time zone to schedule reminders. If a mentor connects their own calendar, we read only busy times from it (never event names or details) to hide those times from booking.

## 5. Google Calendar (for mentors)
Mentors can choose to connect a Google Calendar so their busy times are hidden from students when booking. We ask Google only for permission to see free/busy times (the calendar.freebusy permission) and the email address of the Google account, so we can show which account is connected. We never read event titles, descriptions, locations, attendees or any other calendar content. We use busy times only to hide them from booking, and keep a short-lived copy of them for that purpose. The connection token is stored encrypted. We don't sell or share this data, and we don't use it for advertising or to train AI models. A mentor can disconnect at any time in Calendar & availability, which removes the permission and deletes the stored token and busy times, or can remove access at myaccount.google.com/permissions.

MentorsMD's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.

## 6. Safety checks
Messages, file names, package descriptions and delivery notes are checked automatically for safety (threats, slurs, off-site payment, ghostwriting, requests for passwords and unsafe links). Some checks use outside services: Anthropic (an AI safety check), Google Safe Browsing (links) and Google reCAPTCHA (sign-up, login and other forms). When something is flagged or reported, MentorsMD staff may read the conversation and files involved. We keep a record of flags, reports and the actions our team takes.

## 7. Who we share information with
- The other person on an order: a mentor sees a student's name, messages, files and anything the student adds to their profile; a student sees the mentor's public profile and their messages. Mentors can see that a student is under 18.
- A student's parent or guardian (for students under 18), who gets receipts and a private page showing orders and calls, but not messages.
- Service providers that run parts of the Service for us, only for that purpose: Vercel (hosting), Supabase (database, file storage and live messages), Stripe (payments and payouts), Daily.co (video calls), Resend (email), Sentry (error reports), PostHog (product analytics), Google Analytics (visit counts on public pages), Anthropic (AI safety checks) and Google (reCAPTCHA, Safe Browsing, Calendar for mentors who connect it, and Google Workspace for our own records).
- When the law requires it, to protect someone's safety, or to investigate fraud or abuse.
- A buyer or successor if MentorsMD is merged, sold or reorganized, who must follow this policy.

We don't sell personal information or share it for cross-context behavioral advertising.

## 8. Analytics and cookies
PostHog shows us which pages are visited and clicked, using a cookie. If you're logged in it receives only your internal account id and whether you're a student or mentor, never your name, email or date of birth. Anything typed into forms is masked. Short screen recordings are made only on public pages (such as the homepage and mentor profiles) for visitors who aren't logged in; we never record messages, orders, calls or account pages. Turning on "Do Not Track" in your browser switches PostHog off.

Google Analytics counts visits to our public pages by people who aren't logged in, and sets its own cookies. You can opt out with Google's browser add-on at tools.google.com/dlpage/gaoptout. You can also block or delete cookies in your browser settings, though logging in needs them.

## 9. How long we keep information
- Account information: until you delete your account (see the Delete Your Account page).
- Orders, payments, payouts and credit history: as long as tax and accounting law requires, even after an account is deleted.
- Records of the documents you accepted and of parental consent: as long as we may need them to show that they were given.
- Messages, files and reviews you sent stay with the people you sent them to, shown as from "Deleted user" after you delete your account.
- Call recordings: ${RECORDING_RETENTION_DAYS} days after the order is closed. Visit logs: about 13 months.

## 10. Your choices and rights
- You can see and change most of your information in Settings, and delete your account there at any time.
- You can ask us for a copy of your information, to correct it, or to delete it, by writing to ${CONTACT} from the email on your account. We'll reply within 30 days and may need to confirm it's you.
- You can ask us to stop sending emails you don't need at any time.
- Depending on where you live (for example California, the EU or the UK), you may have extra rights, such as to object to or restrict certain uses, or to complain to a data protection authority. We won't treat you differently for using any of these rights.
- If you're in the EU or UK, we process your information to provide the Service you asked for, for our legitimate interest in running a safe and useful marketplace, with your consent where we ask for it, and to meet legal obligations. Your information is processed in the United States.

## 11. Children and students under 18
MentorsMD is not for children under 13, and we don't knowingly collect information from them; if we learn that we have, we delete it. Students aged 13 to 17 can use MentorsMD only after a parent or guardian gives consent, and get extra protections: mentors see that they are under 18, and attempts to move a conversation with them off the site are treated as a high-severity safety issue. A parent or guardian can withdraw consent at any time from their private parent link, or write to us to see or delete their student's information.

## 12. Security
We protect information with encryption in transit, private storage for files, access limited to staff who need it, and two-step sign-in for staff and mentors. No system is perfectly secure; if we learn of a breach that affects you, we'll tell you as the law requires.

## 13. Changes to this policy
We'll post any changes here with a new effective date. For significant changes we'll ask you to review and accept the new version the next time you sign in.

## 14. Contact
MentorsMD LLC · ${CONTACT} · or use our contact page.`;

const MENTOR_AGREEMENT = `${EFFECTIVE}

This Mentor Agreement is between you, as a mentor, and MentorsMD LLC ("MentorsMD"). It adds to the Terms of Service and Community Guidelines, which also apply to you. You accept it when you join, and again each time you publish or save a package.

## Your promises
${MENTOR_AGREEMENT_POINTS.map((p) => `- ${p}`).join("\n")}

## Independent contractor
You're an independent contractor, not an employee, partner or agent of MentorsMD. You decide your own rates, availability and how you deliver your services, within these rules. You're responsible for your own taxes, insurance and any licenses your work requires. Nothing in this agreement creates an employment relationship.

## Your profile and services
- Everything on your profile, including your training, schools, scores, results and experience, must be true and kept up to date. Tell us promptly if your status changes (for example if you leave your program).
- Only offer services you have real experience with. Describe packages honestly, including what's included and roughly how many hours they take.
- Honor your published rates and packages for students who have already bought them.

## Fees and payouts
- Students pay MentorsMD. MentorsMD keeps a platform fee of ${PLATFORM_FEE_PERCENT}% of each sale, and you receive the rest.
- You're paid once a month, on or around the ${PAYOUT_DAY}th, for the hours you've worked, and for any unused hours on a package once the student approves it or it's approved automatically. Payouts are made through Stripe Connect; you must finish Stripe's setup to sell and to be paid.
- Payment for an order under dispute is paused until a MentorsMD admin decides. If the admin decides a refund is due, you aren't paid for the refunded amount.
- You may not charge students anything outside MentorsMD, ask for tips, or take a student you met on MentorsMD off the site to avoid paying through MentorsMD.

## Working with students
- Reply to messages within 24 hours, show up to booked calls on time, and deliver what your package describes in a reasonable time.
- Give feedback and guidance only. Never write any part of an application, personal statement, essay, activity description or secondary, and never take a test for a student.
- Keep student materials (essays, drafts, scores, recordings) confidential. Use them only to help that student, and never share, publish or reuse them.
- Students under 18: you may choose not to work with them. If you do, never share or ask for phone numbers, emails, social media or outside meeting links, and keep everything on MentorsMD.

## Reviews, recordings and safety
Students may leave reviews of your work. Calls may be recorded, and you and the MentorsMD team can watch recordings of your own calls as described in the Terms. Messages and files are checked automatically for safety. You agree to cooperate with any review of a report or dispute.

## Ending the agreement
You can pause your profile at any time, and delete your account once your open packages are finished and you've been paid. MentorsMD may pause or remove a mentor who breaks this agreement, the Terms or the Community Guidelines, or who receives repeated serious complaints. Your promises about confidentiality and off-site payments continue after you leave.`;

const PARENTAL_CONSENT = `${EFFECTIVE}

MentorsMD connects students applying to medical school with mentors (medical students, residents, undergraduates in BS/MD programs, gap-year students and others on the path to medicine) who are vetted by our senior team. Students aged 13 to 17 need a parent or legal guardian's consent before they can use the site. This form explains what you're agreeing to.

## What your student can do on MentorsMD
- Message mentors through MentorsMD messages. Conversations are checked automatically for safety, and our team may read them if something is flagged.
- Buy hours or packages with a mentor (written feedback and/or video calls). Payment is made when buying. If something goes wrong, a MentorsMD admin reviews it and decides whether to give a refund, and refunds are always given as MentorsMD credit.
- Join video calls in a private MentorsMD room. Calls may be recorded for safety. Only the mentor on the call and the MentorsMD team can watch a recording, the team only looks if there's a problem, and recordings are deleted ${RECORDING_RETENTION_DAYS} days after the order is closed.

## How we protect students under 18
- Mentors can see that a student is under 18, and mentors may choose not to work with students under 18.
- Sharing phone numbers, emails, social media or outside meeting links with a student under 18 is treated as a high-severity safety issue and reviewed by our team.
- You receive a receipt by email for every order, and a private link to see your student's orders and calls (not their messages).

## Your choices
- You can withdraw your consent at any time from your private parent link. Your student's account is then paused, and our team will contact you about any open orders.
- You can ask to see or delete your student's information by writing to ${CONTACT}.
- When your student turns 18, their account becomes a regular account and your parent link stops working.

## Your agreement
By typing your full name below you confirm that you are this student's parent or legal guardian; that you have read the Terms of Service, the Privacy Policy and this form; that you agree to the Terms of Service on your student's behalf; and that you consent to your student using MentorsMD as described here.`;

export const DEFAULT_LEGAL_TEXT: Partial<Record<LegalKind, { title: string; body: string }>> = {
  TERMS: { title: "Terms of Service", body: TERMS },
  PRIVACY: { title: "Privacy Policy", body: PRIVACY },
  MENTOR_AGREEMENT: { title: "Mentor Agreement", body: MENTOR_AGREEMENT },
  PARENTAL_CONSENT: { title: "Parental Consent Form", body: PARENTAL_CONSENT },
};
