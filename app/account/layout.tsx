import { MentorArea } from "@/components/MentorArea";

export const metadata = { title: { absolute: "Settings | MentorsMD", template: "%s | MentorsMD" }, robots: { index: false } };

// Students see this inside the student area sidebar; admins as before.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MentorArea>{children}</MentorArea>;
}
