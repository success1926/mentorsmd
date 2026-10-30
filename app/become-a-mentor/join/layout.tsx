import type { Metadata } from "next";

// The page itself is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Join as a Mentor",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
