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

// The Senior team page (/senior-team). Photos live in /public/images/team.
// `photoPosition` is the CSS object-position for cropping the portrait.
// Bios are the same ones used on admitmd.com.
export type TeamMember = { name: string; title: string; creds?: string; photo: string; photoPosition?: string; bio: string[]; focus: string[] };
export const SENIOR_TEAM: TeamMember[] = [
  {
    name: "Stephen Frederico",
    title: "Founder",
    creds: "Former admissions committee member, University of Pittsburgh School of Medicine",
    photo: "/images/team/stephen.jpg",
    photoPosition: "50% 0%",
    bio: [
      "Stephen C. Frederico is the founder of AdmitMD Consulting and a fourth-year medical student at the University of Pittsburgh School of Medicine, where he is applying into neurological surgery. He brings four years of firsthand experience as a full voting member of his medical school’s admissions committee, having interviewed and evaluated applicants across both traditional MD and combined BS/MD programs.",
      "Before founding AdmitMD, Stephen worked with established admissions consulting firms, where he saw how volume-driven, formulaic advising often fails to reflect the realities of competitive medical school admissions. He created AdmitMD to offer individualized, transparent guidance grounded in real admissions committee insight.",
      "At AdmitMD, Stephen advises students on application strategy, school selection, personal statements and secondary essays, and interview preparation. He believes that developing a strong application narrative is essential for success.",
      "Alongside advising, Stephen has an extensive background in academic medicine and translational neuro-oncology research. His work has focused on brain tumor immunotherapy and treatment resistance, with particular emphasis on diffuse midline glioma. He has conducted research across multiple academic institutions, including Harvard Medical School, and has received competitive research funding from organizations such as the American Society for Clinical Investigation (ASCI), the American Brain Tumor Association (ABTA), and the Henry L. Hillman Foundation. He is also a professional speaker with the Folds of Honor Foundation, supporting military families and educational access.",
      "Education: MD, University of Pittsburgh (2027) · MMSc, Harvard Medical School (2025) · MS, Johns Hopkins University (2021) · BA, College of Charleston (2019)",
    ],
    focus: ["Application strategy", "School selection", "Personal statements & secondary essays", "Interview preparation"],
  },
  {
    name: "Shwetabh",
    title: "VP of Consulting & Business Development",
    creds: "Admissions committee: University of Pittsburgh",
    photo: "/images/team/shwetabh.jpg",
    photoPosition: "50% 15%",
    bio: [
      "Shwetabh is a graduate of the University of Pittsburgh School of Medicine with a clinical interest in internal medicine and a focus on health policy. He has served as an interviewer on the admissions committee, gaining direct experience evaluating applicants and contributing to the selection process. As an admissions consultant, Shwetabh has guided numerous students to acceptance at highly competitive institutions, including Harvard, Stanford, Penn, and Johns Hopkins, as well as several top BS/MD programs. His approach is highly individualized, focused on identifying each student's unique path to medical school and positioning them for long-term success.",
    ],
    focus: ["Comprehensive MD Admissions Strategy", "Post-Bacc & SMP Admissions Strategy", "BS/MD Admissions Strategy"],
  },
  {
    name: "Rachel",
    title: "Director of Operations & Client Experience",
    photo: "/images/team/rachel.jpg",
    photoPosition: "50% 15%",
    bio: [
      "Rachel is an operations professional with over five years of experience in higher education administration and extensive experience in the admissions consulting space. She has a proven track record in scaling organizations by refining workflows, clarifying operational roles, and driving team performance. Rachel began her career at an education consulting startup now valued at over $1 billion, where she helped build the operational infrastructure behind its rapid growth, and is passionate about creating systems that increase efficiency and support team growth.",
      "Rachel holds a bachelor's degree from the University of British Columbia and an MSc in Business Management from Trinity College Dublin.",
    ],
    focus: ["Admissions Consulting Operations", "Client Experience & Advising Standards", "Team Structure & Performance Management"],
  },
];
