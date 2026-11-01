"use client";

import { useLayoutEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { hasSecretParams, recordable } from "@/components/PostHogAnalytics";

// Google Analytics, on the live site only, so local and preview visits
// aren't counted. Privacy rules, because many students are under 18: it runs
// only on public marketing pages (the same list as PostHog recordings) and
// only for visitors who aren't logged in. Addresses carrying a private value
// aren't sent, and Do Not Track is respected.
//
// The site moves between pages without reloading, so once the script has
// loaded it would keep counting every later page. Google's ga-disable switch
// is set before each new page appears (layout effects run before the browser
// paints), which keeps account and admin pages out.

const GA_ID = "G-LWX6L49HTQ";
const LIVE_HOSTS = ["mentorsmd.com", "www.mentorsmd.com"];

export function GoogleAnalytics() {
  const pathname = usePathname() || "/";
  const { status } = useSession();
  const [started, setStarted] = useState(false);

  useLayoutEffect(() => {
    const allowed =
      LIVE_HOSTS.includes(window.location.hostname) &&
      status === "unauthenticated" &&
      recordable(pathname) &&
      !hasSecretParams(window.location.search) &&
      navigator.doNotTrack !== "1";
    (window as any)[`ga-disable-${GA_ID}`] = !allowed;
    if (allowed) setStarted(true);
  }, [status, pathname]);

  if (!started) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
