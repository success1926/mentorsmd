import { MentorArea } from "@/components/MentorArea";

// Mentors and students see this inside their area sidebar (MentorArea).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MentorArea>{children}</MentorArea>;
}
