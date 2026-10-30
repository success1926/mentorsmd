import type { Metadata } from "next";

// The page itself is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to MentorsMD to message your mentor, book calls and see your packages.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
