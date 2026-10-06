# MentorsMD design direction (Sept 2026)

**Color decision (Sept 29, firm): always use the Iris colors.** Tabo wants Iris (purple with pink and blue accents, from the first design) no matter which layout is picked.
- **Core colors:** primary #5536D6, deep #3F24B0, tint #F1EDFF, lilac #DDD5FF, ink #1B1834, muted #5D5973, line #E7E3EF, ground #FBFAF7.
- **Pink accents:** #F5B9CD and light #FCE4EC.
- **Blue accent:** #E4EEFF.
- Directions B and C have been switched to Iris and their palette switches removed. Cobalt and Rose are no longer options.

**Decision (Sept 25): Iris chosen.** Coded on branch `iris-redesign`: theme variables in app/globals.css, fonts via next/font, new homepage with a Leland-style scroll-grow effect (components/ScrollGrow.tsx; sections scale from about 0.9 to 1 as they scroll into view, and the effect is off when "reduce motion" is set), restyled nav, footer, /coaches and profile. Live pages show only real numbers. The "Been where you are" filters are not built yet because they need new coach profile fields.

**Update (Sept 29): Tabo felt Iris still looks too generic.** The problem is the layout and the top bar, not the colors. Direction B was mocked up on the same canvas, built from the reference sites' text.

**Update (Sept 29, later): Direction C (Capsule-style)** was mocked up from Tabo's screen recording of capsule.com. Tabo said the current top bar is repetitive and sloppy, so the top bar was the main focus. Neither B nor C has been chosen or coded yet.

Canvas: "MentorsMD Design Direction" artifact (claude.ai/artifact/1DnDEZuDcA6XhvStVfU9uQ).
- **Row 1:** the Iris designs: Style guide, Homepage (desktop), Find a coach, Coach profile + booking, Homepage (mobile).
- **Row 2, left:** Direction B, with HomeB.dc.html and MobileB.dc.html.
- **Row 2, right:** Direction C, with HomeC.dc.html (desktop), MobileC.dc.html (mobile, with a working menu) and TopBarC.dc.html (top bar states).

**Main design (Sept 30): Leland-style, chosen by Tabo as the main design.** It is based on Tabo's screenshots of joinleland.com. The canvas now has two pages:
- **"Main design":** HomeD.dc.html (desktop), MobileD.dc.html (mobile, with a working menu) and TopBarD.dc.html (the bar after scrolling, with the Browse menu open).
- **"Earlier directions":** Iris row 1, Direction B and Direction C.

The core positioning: a freelance marketplace for getting into medical school where **every mentor is vetted by the MentorsMD senior team** for expertise.

**Mentor side and admin additions (Sept 30):**
- **Mentor dashboard** (MentorDashD, the mentor's home):
  - Availability switch.
  - "Needs your attention" list: revision requests, due soon, disputes.
  - Collapsible Active and Completed order lists, each order row with "Message" and "Open order".
  - A Messages panel with unread dots and an inline thread.
- **Mentor top bar:** Dashboard · Messages · My packages · Payouts.
- **Mentor account page (AccountD):**
  - Availability: pause the profile, with an optional return date and an away note. A paused profile is hidden from Browse and can't be booked; active orders and messages continue.
  - "Remove my profile": offers "Pause instead", and active orders still finish and get paid.
- **Admin People section:**
  - Mentor and student tabs, plus search.
  - View (profile summary and recent orders, with a link to the public profile).
  - Pause and unpause mentors.
  - Remove, with a reason and a warning about active orders; removed accounts can be restored.
- **Backend work needed:**
  - Paused, Removed and Paused-by-admin states on User.
  - A return date and an away message.
  - Unread tracking for messages.

**Tabo's decisions (Sept 30):**
- **Payment wording:** never say "pay when/only when you're happy". Students pay upfront when they book, and MentorsMD holds the payment. Use "Payment held until you approve".
- **Admin: invites.** Say "Joined" instead of "Redeemed". Invites are split into collapsible "Pending invites" (including expired) and "Joined" lists.
- **Admin: disputes.** Split into collapsible Pending and Resolved lists.
- **Admin: discount codes.** The section has been removed.

**All pages mocked up (Sept 30)** in the main design, on the "Main design" page of the canvas. The pages are based on the real repo (mentorsmd-main zip).
- **Row 1:** homepage (desktop and mobile) and the top bar.
- **Student flow:**
  - BrowseD (browse mentors, filters)
  - ProfileD (message first, booking unlocks after the reply)
  - CheckoutD
  - InboxD (orders plus a two-pane messages view)
  - OrderD (tweaks for Student/Mentor and each status; escrow tracker, revision, dispute, release, review)
- **Accounts, mentor tools and admin:**
  - AuthD (log in, sign up, forgot and reset password)
  - OnboardD (invite-only mentor setup)
  - AccountD
  - PackagesD
  - PayoutsD
  - AdminD (stats, disputes, invites, discount codes)
- **Company pages:** AboutD, ContactD, LegalD.
- **Shared components:** NavD (a role-aware top bar for logged out, student, mentor and admin) and FooterD. Every page imports them.
- **Wording:** visible copy says "mentor" everywhere.
- **Suggested fixes built into the mockups (not yet in the code):**
  - A Messages link in the nav.
  - The revision note is shown on the order page.
  - Revision, dispute and release are hidden while an order is disputed.
  - A payouts banner on My packages, because checkout is blocked until payouts are connected.
  - Readable "still needed" items on Payouts, and no debug panel.
  - Confirmation before removing a package.
  - "In progress" instead of "Pending" for orders in escrow.
  - The mentor is shown at checkout.
- **Code issues found while reading the repo:**
  - The review window is 96h in the code but 48h in comments and an older README.
  - Checkout's cancel URL /gigs/{id} returns a 404.
  - Discount codes are never applied.
  - No page is protected by route.
  - The homepage FAQ omits auto-release and revisions/disputes.

## Main design (Leland-style)
- **Look:** white background, with Iris light purple as the main color.
  - Buttons are light purple pills #BFB0FF with dark ink text.
  - Tints #F1EDFF / #F6F3FF / #DDD5FF, primary #5536D6 for links, stars and badges.
  - Pink #F5B9CD / #FCE4EC and blue #E4EEFF as accents.
  - Type: Fraunces 400 for large serif headlines, Instrument Sans for everything else.
- **Top bar:**
  - Logo, then Browse mentors ▾, How we vet mentors, Reviews and Become a mentor.
  - On the right, "Log in" and a "Get started" pill.
  - After scrolling, the bar turns white and a row of quick links appears under it: Popular, Personal statement, Secondaries, MMI, Traditional interviews, MCAT, School list, Reapplicants, Non-traditional, DO schools, MD/PhD, Gap years.
  - The Browse menu groups mentors by service, by mentor stage, and "Been where you are".
- **Homepage sections:**
  1. Light lilac hero: "Your white coat starts here", a big search pill, topic chips, a star rating with the review count, and an "Our mentors study at" strip.
  2. "Getting into med school is hard. You don't have to do it alone." with 3 tall photo cards: Write a standout application / Ace your interviews / Plan your path.
  3. A full-width photo: "Every mentor, vetted.", then 4 points: Verified, Reviewed, Approved, Selective (only [N]% of mentor applicants accepted).
  4. "Meet a few of our mentors": 4 cards, each with a "Vetted" badge.
  5. "Everything you need to get in.": an accordion on the left and a media panel on the right that changes with the selection. The last item is the escrow ("Payment held until you approve").
  6. "Don't just take our word for it.": a masonry wall of video and text testimonials on a pale lilac band.
  7. "Ready when you are." call to action, then the footer.
- **Placeholders:** all photos, ratings, review counts, schools and quotes. Real mentor photos matter most here.

## Direction C (Capsule-style)
- **Top bar:**
  - Logo on the left, then four links: How it works, Find a coach, For coaches, Questions.
  - On the right, "Sign in" as a text link and one "Get started" button.
  - Links are letter-spaced serif capitals.
  - Over the hero the bar is transparent with an outlined square button. Once you scroll, it sticks to the top, turns white and the button fills in solid.
  - On phones: logo and a menu button only, with a full-screen menu holding the links and both buttons.
- **Structure (mirrors Capsule):**
  1. Full-bleed purple hero with a 3-line headline ("Get in with someone who just did."), one sentence of copy and a square button. Big flat shapes bleed off the right edge: an arch, a plus and a circle.
  2. "Find a coach for where you are" row with an underlined dropdown and a square arrow button.
  3. "A better way to get help": 3 square color-block photo cards with captions.
  4. Tinted "How MentorsMD works" band with 3 centered line icons.
  5. A serif equation: "Someone who just got in + Your first draft = An application you're proud to send".
  6. A big [4.9] rating with 5 stars, then a review carousel (photo on top, purple panel below).
  7. "Our coaches study and train at": a serif pull quote and school names. This replaces Capsule's press section, because we have no press yet.
  8. FAQ with chevrons and a "See more questions" link.
  9. Tinted footer with a shape bleeding off the bottom corner.
- **Type:** Figtree 700/800 for headlines and body text; Newsreader for nav links, buttons, the equation and quotes.
- **Colors:**
  - Hero #5536D6 with light-lilac subtext #E6E0FF.
  - Pink #F5B9CD for the buttons, with dark ink text.
  - Shapes: blue #E4EEFF, lilac #DDD5FF and pink.
  - Band and footer in tint #F1EDFF.
  - Links and the arrow button in #5536D6.
  - Stars #EC8FB2. Pink text on white uses #B8336A so it stays readable.

## Direction B ("See one, do one, teach one")
Built from Tabo's reference sites: cerebelly.com, awaytravel.com, capsule.com, engine.com, hioscar.com, wework.com, 53stations.com, ivycoach.com, encourageme.com.
- **Type:** Bricolage Grotesque 800 for headlines, Instrument Serif italic for the emphasized words, Instrument Sans for body text.
- **Colors (Iris):**
  - Ground #FBFAF7, ink #1B1834.
  - Deep bands #3F24B0.
  - Buttons #5536D6 with white text.
  - Blue #E4EEFF, pink #F5B9CD, lilac #DDD5FF and light pink #FCE4EC for the color blocks.
- **Ideas borrowed:**
  - Search-first hero (WeWork) with a rotating "Coaching for your ___" word (Engine).
  - Arch photo frame with floating coach, message and escrow cards, plus a spinning "verified" sticker.
  - Stage picker (Cerebelly): Planning, Primary, Secondaries, Interviews, Reapplying.
  - Named features (Away): "Talk first", "The Hold" (escrow), "Just did".
  - Coach cards that lead with credentials (Ivy Coach), with "Been where you are" filters.
  - Stats band (Oscar/WeWork).
  - "See one, do one, teach one" origin section (53 Stations).
  - Comparison table versus consulting firms and going it alone (Cerebelly).
  - Color-blocked testimonials and FAQ accordion (Capsule).
  - Closing call to action with corner shapes (Encourage).
- **Next:** get real coach and student photos. Nothing will make the site look less generic than real faces.

## Type (Direction A)
Fraunces 600 (Google Fonts) for headlines and coach names; Instrument Sans for body text and UI.

## Taken from Leland
- Coach cards that lead with credentials: role, school, rating, price and service tags.
- Category chips directly under the hero.
- Social proof strip.
- Filter sidebar that includes a "specialized experience" section, which we call "Been where you are": reapplicant, non-trad, first-gen, DO, gap years.

## Our own
- The escrow tracker ("you only pay when you're happy"), used on the homepage, the profile sidebar and order pages.
- Message-first booking shown as a 3-step checklist.
- "Just did" framing: coaches are med students and residents, filterable by stage.

## Placeholders to fill with real data
Ratings, review counts, prices, school names, testimonials, coach bios, photos, support email, social links. The sample coaches are illustrative. Note that the review window is described as 72 hours on the Iris desktop mockup and 96 hours on the Iris mobile one; confirm the real number.
