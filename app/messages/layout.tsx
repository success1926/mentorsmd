import { MentorArea } from "@/components/MentorArea";

// Mentors see this inside the mentor area sidebar; students as before.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MentorArea>{children}</MentorArea>;
}
