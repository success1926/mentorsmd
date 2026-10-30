import type { Metadata } from "next";

// The page itself is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a free MentorsMD account to message vetted medical school admissions mentors and book help.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
