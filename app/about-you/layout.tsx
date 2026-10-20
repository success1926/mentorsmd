import { MentorArea } from "@/components/MentorArea";

// Students see this inside the student area sidebar.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MentorArea>{children}</MentorArea>;
}
