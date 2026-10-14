import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { AccountGate } from "@/components/AccountGate";
import { Tracker } from "@/components/Tracker";
import { PostHogAnalytics } from "@/components/PostHogAnalytics";
import { SitePreviewBar } from "@/components/website/SitePreviewBar";
import { siteUrl } from "@/lib/siteUrl";
import { hasReviewWall } from "@/lib/reviewWall";

// This is what actually determines how the site looks when someone
// finds it via Google on their phone - the title/description below are
// what shows in the search result itself, and the openGraph block is
// what shows if a link gets shared in a text or on social media (a
// proper preview card instead of a bare link).
export const metadata: Metadata = {
  // Makes the link-preview image (app/opengraph-image.png) a full
  // https://mentorsmd.com/... address, which texts and social apps need.
  metadataBase: new URL(siteUrl()),
  title: "MentorsMD",
  description: "One-on-one help from med students and residents, every one vetted by our senior team.",
  manifest: "/manifest.json", // lets someone "Add to Home Screen" on their phone
  openGraph: {
    title: "MentorsMD",
    description: "One-on-one help from med students and residents, every one vetted by our senior team.",
    type: "website",
  },
};

// themeColor lives in a separate `viewport` export as of newer Next.js
// versions, rather than inside `metadata` - this is what colors the
// phone's browser toolbar to match the brand.
export const viewport: Viewport = {
  themeColor: "#5536D6",
};

// Brand fonts, self-hosted by Next.js (no request to Google at page load).
// Fraunces = headlines and coach names; Instrument Sans = everything else.
const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display-loaded", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body-loaded", display: "swap" });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The Reviews link (top bar and footer) only shows once there are reviews to show.
  const showReviews = await hasReviewWall();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>
          <SitePreviewBar />
          <TopNav showReviews={showReviews} />
          <AccountGate />
          <Tracker />
          <PostHogAnalytics />
          <main className="site-main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
