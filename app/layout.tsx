import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { AccountGate } from "@/components/AccountGate";
import { Tracker } from "@/components/Tracker";
import { PostHogAnalytics } from "@/components/PostHogAnalytics";
import { SitePreviewBar } from "@/components/website/SitePreviewBar";
import { SiteEditButtons } from "@/components/website/SiteEditButtons";
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
  // As on AdmitMD: "MentorsMD | what we do" on the homepage, "Page | MentorsMD" everywhere else.
  title: { default: "MentorsMD | Medical School Admissions Mentors, Vetted by Our Senior Team", template: "%s | MentorsMD" },
  description:
    "One-on-one medical school admissions help from vetted med students and residents: personal statements, secondaries, MMI and interview prep, MCAT strategy and school lists.",
  manifest: "/manifest.json", // lets someone "Add to Home Screen" on their phone
  openGraph: {
    title: "MentorsMD | Medical School Admissions Mentors, Vetted by Our Senior Team",
    description: "One-on-one medical school admissions help from med students and residents, every one vetted by our senior team.",
    type: "website",
  },
};

// themeColor lives in a separate `viewport` export as of newer Next.js
// versions, rather than inside `metadata` - this is what colors the
// phone's browser toolbar to match the brand.
export const viewport: Viewport = {
  themeColor: "#5536D6",
};

// Brand fonts, self-hosted by Next.js (no request to Google at page load). The same three as AdmitMD:
// Newsreader = headlines and mentor names; Hanken Grotesk = everything else; IBM Plex Mono = the small
// capital labels above headings.
const display = Newsreader({ subsets: ["latin"], weight: ["300", "400", "500"], style: ["normal", "italic"], adjustFontFallback: false, variable: "--font-display-loaded", display: "swap" });
const body = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body-loaded", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono-loaded", display: "swap" });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The Reviews link (top bar and footer) only shows once there are reviews to show.
  const showReviews = await hasReviewWall();
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <SitePreviewBar />
          <TopNav showReviews={showReviews} />
          <AccountGate />
          <Tracker />
          <PostHogAnalytics />
          <main className="site-main">{children}</main>
          <Footer />
          <SiteEditButtons />
        </Providers>
      </body>
    </html>
  );
}
