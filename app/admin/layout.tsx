import type { Metadata } from "next";

// Everything under /admin: browser tabs read "<page> | MentorsMD Admin"
// (each area's layout.tsx sets its own title), and search engines are
// asked not to list or follow any of it.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | MentorsMD Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
