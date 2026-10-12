"use client";

import { useCallback, useEffect } from "react";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

// Spam protection shared by the public forms.
//  - useRecaptcha(): loads Google reCAPTCHA v3 (invisible) when a site key
//    is set, and gives a token for each submit. No key: returns undefined
//    and the server skips the check.
//  - <Honeypot />: a hidden field only bots fill in.

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (!SITE_KEY || typeof window === "undefined") return Promise.resolve();
  if ((window as any).grecaptcha?.execute) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        resolve(); // the server decides; a blocked script shouldn't freeze the form
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export function useRecaptcha() {
  useEffect(() => {
    loadScript();
  }, []);

  return useCallback(async (action: string): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    await loadScript();
    const g = (window as any).grecaptcha;
    if (!g?.execute) return undefined;
    try {
      return await new Promise<string>((resolve, reject) => {
        g.ready(() => g.execute(SITE_KEY, { action }).then(resolve, reject));
      });
    } catch {
      return undefined;
    }
  }, []);
}

export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: -10000, top: "auto", width: 1, height: 1, overflow: "hidden" }}>
      <label>
        Website
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export { HONEYPOT_FIELD };
