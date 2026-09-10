import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

// This is what actually determines how the site looks when someone
// finds it via Google on their phone - the title/description below are
// what shows in the search result itself, and the openGraph block is
// what shows if a link gets shared in a text or on social media (a
// proper preview card instead of a bare link).
export const metadata: Metadata = {
  title: "MentorsMD",
  description: "Book coaching sessions with vetted med students and residents",
  manifest: "/manifest.json", // lets someone "Add to Home Screen" on their phone
  openGraph: {
    title: "MentorsMD",
    description: "Book coaching sessions with vetted med students and residents",
    type: "website",
  },
};

// themeColor lives in a separate `viewport` export as of newer Next.js
// versions, rather than inside `metadata` - this is what colors the
// phone's browser toolbar to match the brand.
export const viewport: Viewport = {
  themeColor: "#1E5631",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TopNav />
          <main className="container">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
