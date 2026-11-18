import { MentorArea } from "@/components/MentorArea";

export const metadata = { title: { absolute: "About You | MentorsMD", template: "%s | MentorsMD" }, robots: { index: false } };

// Students see this inside the student area sidebar.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MentorArea>{children}</MentorArea>;
}
