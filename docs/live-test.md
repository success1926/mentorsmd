# MentorsMD live test: to-do list

*Updated Oct 1, 2026 for Phase 1: packages now cost $50 to $5,000, and addresses changed (/coaches → /mentors).*

**Who does what**

- 🛠 **You as Admin**: your existing admin login.
- 🩺 **You as Mentor**: a *new* account. One login can't be both admin and mentor, so you need a second email for this.
  - Tip: use `youremail+mentor@gmail.com`. Gmail delivers it to your normal inbox, but the site treats it as a different email.
- 🎓 **Friend as Student**: your friend's own account.

**Money:** the live site takes **real payments**. Use a **$50 package** (the minimum). The admin refund test (section 9) gives the money back.

**Setup:** use 2 browsers so you can stay logged in twice. For example, Chrome for Admin and Safari for Mentor. Your friend uses their own device.

**If something fails:** take a screenshot (⌘ + Shift + 4), note the section number, and keep going.

---

## 1. First look (anyone, logged out, on phone *and* computer)
- [ ] The homepage shows the new design. The search bar and the 5 quick chips work.
- [ ] Top bar links work: Browse mentors, How we vet mentors, Reviews, Become a mentor, Log in, Get started.
- [ ] On a phone, the ☰ menu opens and closes, and no page scrolls sideways.
- [ ] Footer links all open a page: About, Contact, Terms, Privacy, Become a mentor.
- [ ] The Contact page shows your contact email.
- [ ] A made-up address like `mentorsmd.com/xyz` shows the purple "We couldn't find that page".

## 2. 🛠 Admin: invite yourself as a mentor
- [ ] Log in as admin. Admin shows the stat cards, Disputes, Invite a mentor and People.
- [ ] There is **no** discount-code section.
- [ ] Invite `youremail+mentor@gmail.com`. You see a green "Invite sent" message.
- [ ] The invite shows under **Pending**. **Resend** sends it again.
- [ ] Test cancelling: invite a fake email (e.g. `test123@example.com`), then click **Cancel**. It disappears.

## 3. 🩺 Mentor: join and set up
- [ ] Open the invite email and click the link. "Set up your mentor profile" shows your email badge.
  - If you're still logged in as admin in that browser, it says "You're already logged in". Click **Log out and continue**.
- [ ] Fill in name, credential, bio and password, then **Create my profile**. You land on **Account**.
- [ ] 🛠 Back in Admin, the invite moved to **Joined** with your name and date, and **Profile** opens it.
- [ ] Account → upload a **photo**. It shows square, top right in the menu and on your profile.
- [ ] Account → **About you**: pick a stage and school type (plus any backgrounds), then **Save answers**.
- [ ] Account → **Cal.com**: paste your Cal.com link (make a free account at cal.com first). It shows **Connected**.
- [ ] Optional: in **Show bookings on orders automatically**, click **Create secret**, then follow the 3 steps in Cal.com.
- [ ] Account → **Sync to your calendar**: **Connect my calendar**, then **Add to Google Calendar**. A MentorsMD calendar appears in Google (it can take a few hours to fill in).
- [ ] **Payouts**: **Connect bank account** takes you through Stripe and back, and shows **Connected**. There's no debug box.

## 4. 🩺 Mentor: packages
- [ ] With no packages yet, the top bar shows **+ Add package**.
- [ ] My packages shows a yellow "Connect payouts" banner until payouts is connected.
- [ ] **New package A** (the description needs at least 30 words):
  - Title "Test written review"
  - Price **$50**
  - Service: Personal statement
  - Format: **Written feedback**
  - Turnaround: 3 to 5 days
  - **Publish**. It should show **Live in search**.
- [ ] **New package B:**
  - Title "Test call"
  - Price **$50**
  - Service: MMI prep
  - Format: **Live video session**
  - Turnaround: Scheduled call
  - 1 call, 30 min
  - **Publish**.
- [ ] Edit package A, change the price to $55, and save. Then change it back to $50.
- [ ] Make a third throwaway package, then **Remove** it. It asks for confirmation, then it's gone.
- [ ] **Dashboard**: shows "Hi, name", **+ Add package**, the availability switch and Needs your attention. Messages is empty.

## 5. 🎓 Friend: sign up and browse
- [ ] Friend creates a student account (try **email**; Google also works).
- [ ] **Browse mentors**: your mentor card shows Vetted, your tags, and both packages.
- [ ] Filters:
  - [ ] **MMI prep** shows only package B.
  - [ ] **Written feedback** shows only package A.
  - [ ] **$50 to $100** still shows you.
  - [ ] **Resident** hides you (unless you picked Resident).
- [ ] Filter pills appear above the results. **✕** removes one, and **Clear all** removes them all.
- [ ] The quick links across the top work, and so does sort.
- [ ] Searching your name finds you.
- [ ] Open your profile:
  - [ ] It shows packages, "No reviews yet", and the Message box.
  - [ ] **Book** buttons are greyed out with "unlocks once you reply".

## 6. Messaging
- [ ] 🎓 Friend types a message on your profile and clicks **Send message**. The Messages page opens.
- [ ] 🩺 You get an email "New message from …".
  - [ ] **Messages** in the top bar shows a red **1**.
  - [ ] Your **Dashboard** messages panel shows the count.
- [ ] 🩺 Reply from **Messages**.
  - [ ] Your badge clears.
  - [ ] 🎓 The friend sees the reply appear **without refreshing**, and gets a red badge on any other page.
- [ ] Both: attach a PDF and download the other person's. There's **no video button** anywhere in Messages.
- [ ] 🎓 The friend's side panel now has **Book** enabled.

## 7. 🎓 Order A: written package (pay → deliver → approve → review)
- [ ] Book package A. Checkout shows your mentor card, the package details and a due date picker.
- [ ] Click Pay, then **Back / cancel** on the Stripe page. You return to checkout with "Payment was cancelled". This used to 404.
- [ ] Pay for real ($50).
  - [ ] The order page shows "Payment received". The tracker shows **Paid → Held**.
- [ ] 🩺 You get a "New order" email. The order appears under **Dashboard → Active orders**.
- [ ] 🩺 Change the due date on the order. It updates.
- [ ] 🎓 **Request a revision** with a note.
  - [ ] 🩺 You see the yellow "Revision requested" box with the note.
  - [ ] You get an email.
- [ ] 🩺 **Mark work as complete**. 🎓 The friend gets an email, and the tracker shows **Delivered**.
- [ ] 🎓 **Approve and release payment**.
  - [ ] Status shows **Complete**.
  - [ ] 🩺 You get "Payment released".
  - [ ] Payouts → "Paid to you" shows $40 (after the 20% fee).
- [ ] 🎓 Leave a 5-star review. It shows on your profile, and 🩺 you get an email.

## 8. 🎓 Order B: call package (calls and calendar)
- [ ] Book and pay for package B ($50).
- [ ] On the order, **Book a call** appears. It opens your Cal.com with the friend's name pre-filled.
- [ ] Book a time at least 25 hours away.
  - [ ] Refresh the order: the call shows (only if you did the webhook in section 3).
  - [ ] Both of you get "Call booked" emails.
- [ ] *(If you skipped the webhook)*: 🩺 You use **Add call time** on the order instead.
- [ ] 🩺 **Mark work as complete** is greyed out: "Available once the included call has happened".
- [ ] More than 24 hours out, **Reschedule** and **Cancel** are visible and open Cal.com.
- [ ] 10 minutes before the call, **Join** turns on. Both of you click it and land in the **same** video room.
- [ ] After the call ends, 🩺 **Mark work as complete** works.
- [ ] Booked calls show up in the Google Calendar you connected.
- [ ] *(Alternative)* On another order, the 🎓 friend clicks **I don't need the call**. 🩺 Mark complete then works.

## 9. Disputes (gets your money back)
- [ ] 🎓 Book package A again ($50). On the order, click **Report a problem → Open a dispute** with a reason.
- [ ] While disputed:
  - [ ] Revision, Report a problem and Approve disappear for the friend.
  - [ ] Mark complete disappears for 🩺 you.
- [ ] 🛠 You get a "Dispute opened" email. Admin → Disputes → **Pending** shows it.
- [ ] 🛠 **Respond / ask for details**: post a question.
  - [ ] 🎓 The friend sees it on the order and replies.
  - [ ] Emails go both ways.
- [ ] 🛠 **Refund student**.
  - [ ] The friend gets the $50 back on their card (Stripe shows it).
  - [ ] It moves to **Resolved: Refunded to student**.
- [ ] *(Optional)* Repeat with **Release to mentor** to see "Released to mentor".

## 10. 🛠 Admin: People
- [ ] The **Mentors** and **Students** tabs show counts. Searching your name finds you.
- [ ] **View** shows your credential, tags, Cal.com status, packages and recent orders.
- [ ] **Pause** your mentor account.
  - [ ] It disappears from Browse.
  - [ ] **Unpause** brings it back.
- [ ] **Remove** the friend's student account (type a reason).
  - [ ] Within about 5 minutes they're logged out and can't log in.
  - [ ] **Restore** lets them in again.
- [ ] Removing someone with an active order shows how many active orders they have.
- [ ] The earnings cards at the top roughly match Stripe.

## 11. 🩺 Mentor: pause and remove yourself
- [ ] Turn the **Dashboard availability switch** off.
  - [ ] It shows "Paused", and you're hidden from Browse.
  - [ ] Turn it back on.
- [ ] Account → **Availability**: pause with a return date tomorrow and a note.
  - [ ] Your profile shows "away until …" with the note.
  - [ ] Checkout is blocked.
  - [ ] Tomorrow you're back automatically.
- [ ] **Remove my profile**: the popup offers **Pause instead**. Click **Yes, remove**.
  - [ ] You're hidden, but you can still log in.
  - [ ] **Restore my profile** brings you back.

## 12. Accounts and passwords
- [ ] **Forgot password**:
  - [ ] The email arrives and the link works.
  - [ ] The old password stops working.
  - [ ] Using the link a second time fails.
- [ ] Account → **Sign-in & security → Change password** opens a pop-up and ends on a "Your password has been changed" screen.
- [ ] Logging in sends each role to its own page: student → Browse, mentor → Dashboard, admin → Admin.
- [ ] Google sign-in with your **mentor** email is refused (expected: mentors use email login).
- [ ] 🛠 Admin left idle for about 58 minutes shows "Still there?", then logs out at 60 minutes.

## 13. Things that happen on a timer (check over the next few days)
- [ ] An order delivered and not approved for 96 hours releases automatically (runs daily at 3am UTC).
- [ ] An order past its due date and not delivered: 🩺 you get a daily "overdue" email.
- [ ] A paid call order with no call booked:
  - [ ] The friend gets a "Book your call" email after a day.
  - [ ] At the due date it goes **On hold**.

---

When you've finished, send me anything that failed (screenshot + section number) and I'll fix it. Also send anything that *felt* awkward, even if it technically worked.
