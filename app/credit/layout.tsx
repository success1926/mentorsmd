import { MentorArea } from "@/components/MentorArea";

// Students see this inside the student area sidebar; admins as before.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MentorArea>{children}</MentorArea>;
}
