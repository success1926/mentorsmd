import { warnOnce } from "@/lib/warnOnce";
import { fetchWithTimeout } from "@/lib/request";

// Google reCAPTCHA v3 (invisible: no puzzle, it scores each request).
// Used on signup, login, forgot password, mentor signup and the mentor
// application form.
//
// Env: RECAPTCHA_SECRET_KEY (server) and NEXT_PUBLIC_RECAPTCHA_SITE_KEY
// (browser; RECAPTCHA_SITE_KEY is accepted as an alias). Create both at
// https://www.google.com/recaptcha/admin (choose "Score based (v3)").
// With no secret set, checks are skipped and everything works as before.

// Google scores from 0.0 (bot) to 1.0 (person). 0.5 is Google's default.
export const RECAPTCHA_MIN_SCORE = 0.5;

export function recaptchaEnabled() {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    warnOnce("recaptcha", "RECAPTCHA_SECRET_KEY is not set - reCAPTCHA checks are skipped.");
    return false;
  }
  return true;
}

// True if the request passes (or reCAPTCHA isn't set up). If Google can't
// be reached, the request is allowed: the rate limits still apply.
export async function verifyRecaptcha(token: unknown, action: string, ip?: string): Promise<boolean> {
  if (!recaptchaEnabled()) return true;
  if (typeof token !== "string" || !token || token.length > 4000) return false;
  try {
    const params = new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET_KEY!, response: token });
    if (ip) params.set("remoteip", ip);
    const res = await fetchWithTimeout("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }, 4000);
    const data: any = await res.json();
    if (!data.success) return false;
    // v3 responses carry a score and the action name; v2 invisible keys don't.
    if (typeof data.score === "number" && data.score < RECAPTCHA_MIN_SCORE) return false;
    if (data.action && data.action !== action) return false;
    return true;
  } catch (err) {
    console.error("reCAPTCHA check failed - allowing the request:", err);
    return true;
  }
}

export const RECAPTCHA_FAILED = "We couldn't confirm you're a person. Please refresh the page and try again.";
