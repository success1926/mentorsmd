// Marketing content you fill in yourself. Anything left empty is simply
// hidden on the site - nothing placeholder-y ever shows to visitors.
// (See "Content to supply" in the open-questions doc.)

// Shown in the "Our mentors study at" strip under the hero. Use only
// schools your current mentors actually attend.
export const MENTOR_SCHOOLS: string[] = [
  // "Johns Hopkins",
  // "UCSF",
];

// e.g. 12 -> "Only 12% of people who apply to mentor are accepted."
// Leave null until you have a real number.
export const MENTOR_ACCEPTANCE_RATE: number | null = null;

// Hand-picked testimonials (with permission). Real reviews left on
// completed orders are added to the wall automatically as well.
export type Testimonial = { name: string; detail: string; quote: string; rating?: number };
export const TESTIMONIALS: Testimonial[] = [
  // { name: "Jordan L.", detail: "Accepted to [School]", quote: "..." },
];

// Optional photos (put files in /public/images and list the paths here).
// Without a photo, each card shows the brand gradient instead.
export const PHOTOS = {
  pathApplication: "", // e.g. "/images/writing.jpg"
  pathInterviews: "",
  pathPlan: "",
  vetting: "",
};

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";
