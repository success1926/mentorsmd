// Marketing content you fill in yourself. Anything left empty is simply
// hidden on the site - nothing placeholder-y ever shows to visitors.
// (See "Content to supply" in the open-questions doc.)
//
// These are now only the built-in DEFAULTS: admins edit the live text and
// photos in Admin -> Website (lib/siteContent.ts lists every field).

// Shown in the "Our mentors study at" strip under the hero. Use only
// schools your current mentors actually attend.
export const MENTOR_SCHOOLS: string[] = [
  // "Johns Hopkins",
  // "UCSF",
];

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

// The Senior team page (/senior-team). Photos live in /public/images/team.
// `photoPosition` is the CSS object-position for cropping the portrait.
// Bios are adapted for MentorsMD from the ones on admitmd.com.
export type TeamMember = { name: string; title: string; creds?: string; photo: string; photoPosition?: string; bio: string[]; focus: string[] };
export const SENIOR_TEAM: TeamMember[] = [
  {
    name: "Stephen Frederico",
    title: "Co-founder",
    creds: "Four years on the University of Pittsburgh School of Medicine admissions committee",
    photo: "/images/team/stephen.jpg",
    photoPosition: "50% 0%",
    bio: [
      "Stephen C. Frederico is a fourth-year medical student at the University of Pittsburgh School of Medicine, where he is applying into neurological surgery. He spent four years as a full voting member of his medical school’s admissions committee, interviewing and evaluating applicants for both traditional MD and combined BS/MD programs.",
      "He has advised applicants on application strategy, school selection, personal statements and secondary essays, and interview preparation, and he believes a strong application narrative is essential for success. He has also seen how volume-driven, formulaic advising can fail applicants, which is why he cares about individualized, transparent guidance grounded in real admissions committee insight.",
      "At MentorsMD, Stephen interviews every prospective mentor, looking for the same things an admissions committee would: real experience and outstanding results.",
      "Alongside advising, Stephen has an extensive background in academic medicine and translational neuro-oncology research, focused on brain tumor immunotherapy and treatment resistance, particularly in diffuse midline glioma. He has conducted research at multiple academic institutions, including Harvard Medical School, and has received competitive research funding from the American Society for Clinical Investigation (ASCI), the American Brain Tumor Association (ABTA) and the Henry L. Hillman Foundation. He is also a professional speaker with the Folds of Honor Foundation, supporting military families and educational access.",
      "Education: MD, University of Pittsburgh (2027) · MMSc, Harvard Medical School (2025) · MS, Johns Hopkins University (2021) · BA, College of Charleston (2019)",
    ],
    focus: ["Application strategy", "School selection", "Personal statements & secondaries", "Interview preparation"],
  },
  {
    name: "Shwetabh",
    title: "Co-founder",
    creds: "Admissions committee interviewer, University of Pittsburgh School of Medicine",
    photo: "/images/team/shwetabh.jpg",
    photoPosition: "50% 15%",
    bio: [
      "Shwetabh is a graduate of the University of Pittsburgh School of Medicine with a clinical interest in internal medicine and a focus on health policy. He has served as an interviewer on the admissions committee, evaluating applicants and contributing to the selection process.",
      "He has guided numerous students to acceptance at highly competitive institutions, including Harvard, Stanford, Penn and Johns Hopkins, as well as several top BS/MD programs. His approach is highly individualized: finding each student’s own path to medical school and positioning them for long-term success.",
      "At MentorsMD, Shwetabh interviews every prospective mentor and looks for that same individualized approach, so students get advice built around them rather than a template.",
    ],
    focus: ["MD admissions strategy", "Post-bacc & SMP admissions", "BS/MD admissions"],
  },
  {
    name: "Rachel",
    title: "Director of Operations & Client Experience",
    photo: "/images/team/rachel.jpg",
    photoPosition: "50% 15%",
    bio: [
      "Rachel is an operations professional with more than five years of experience in higher education administration and extensive experience in admissions consulting. She has a proven track record of scaling organizations by refining workflows, clarifying roles and driving team performance. She began her career at an education consulting startup now valued at over $1 billion, where she helped build the operational infrastructure behind its rapid growth.",
      "At MentorsMD, Rachel interviews every prospective mentor and focuses on the systems behind a consistent experience for students and mentors.",
      "Rachel holds a bachelor’s degree from the University of British Columbia and an MSc in Business Management from Trinity College Dublin.",
    ],
    focus: ["Operations", "Mentor standards", "Student experience"],
  },
];
