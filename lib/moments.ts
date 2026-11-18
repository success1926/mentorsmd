// The site's small "fun moments" (Nov 18, 2026), each with its own switch. Set one to false to turn that moment
// off everywhere; the page then behaves exactly as it did before. The preview of every moment (with Keep / Remove)
// is the MentorsMD Moments page in the AdmitMD repo's mockups/mentorsmd-moments.html.
// People who ask their device for reduced motion never see any of these, whatever the switches say.
// Code: components/Moments.tsx (the pieces), lib/confetti.ts, app/moments.css.
export const MOMENTS = {
  // 1. Booking a call: the picked time gets a check stamp, a small confetti pop, and a "Booked" chip floats down.
  booking: true,
  // 2. Checkout success: confetti and a "You're in" card that flips in on the package page after paying.
  checkout: true,
  // 3. A new acceptance in Results: the badge pops and confetti bursts from it.
  acceptance: true,
  // 4. Mentor invite accepted (Become a mentor -> join): a MentorsMD badge slides onto a white coat.
  mentorWelcome: true,
  // 5. Payouts: a new paid payout counts up with a green check (once per payout, per browser).
  payout: true,
  // 6. Find a mentor: cards rise in one after another, photos zoom on hover, filter changes slide cards into place.
  mentorCards: true,
  // 7. Mentor profile: the stars fill one at a time, then the Book button pulses once.
  profileStars: true,
  // 8. How it works: a purple line draws along each row as the list scrolls into view.
  howItWorks: true,
  // 9. Reviews wall: the cards drift in at slightly different times as they scroll into view.
  reviewsWall: true,
  // 10. Messages: new messages slide up, and a small "Sent" tick pops after yours sends.
  messages: true,
  // 11. Call page: a ring fills during the last hour before Join opens; then Join pulses.
  joinCountdown: true,
  // 12. Student and mentor areas: each page fades up when you move between sidebar pages.
  pageFade: true,
  // 13. Gift claim: a gift box opens and the gift rises out of it.
  giftOpen: true,
} as const;

export type Moment = keyof typeof MOMENTS;

// On, and the person hasn't asked for reduced motion. Browser only (false on the server).
export function momentOn(m: Moment) {
  if (!MOMENTS[m]) return false;
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
