import { MentorArea } from "@/components/MentorArea";

export const metadata = { title: { absolute: "Calendar | MentorsMD", template: "%s | MentorsMD" }, robots: { index: false } };

// Mentors and students see this inside their area sidebar (MentorArea).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MentorArea>{children}</MentorArea>;
}
