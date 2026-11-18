"use client";

import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MOMENTS, momentOn, type Moment } from "@/lib/moments";
import { burstFrom, SMALL, BIG } from "@/lib/confetti";
import { money } from "@/lib/options";

// The pieces behind the site's fun moments (lib/moments.ts has the switches; app/moments.css the looks).
// Everything here shows its finished state straight away when a moment is off or the person asks for
// reduced motion, so nothing is ever left hidden.

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// ---------- small helpers ----------

// A small "Booked ✓" chip that floats down from where a button was, then fades. Lives on the page, so it
// keeps going when the pop-up that held the button closes.
export function flyChip(from: DOMRect | null, text: string) {
  if (!from || (!from.width && !from.height) || typeof document === "undefined") return;
  const chip = document.createElement("div");
  chip.className = "mm-fly-chip";
  chip.setAttribute("aria-hidden", "true");
  chip.textContent = text;
  chip.style.left = `${from.left + from.width / 2}px`;
  chip.style.top = `${from.top + from.height / 2}px`;
  document.body.appendChild(chip);
  chip.addEventListener("animationend", () => chip.remove());
  setTimeout(() => chip.remove(), 2500);
}

// "rest" until the element scrolls into view, then "in". Starts "pending" (hidden, waiting) only for elements
// that begin below the fold, so anything on screen at load is never hidden.
export function useReveal<T extends HTMLElement>(moment: Moment, { hideBelowFold = false } = {}) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"rest" | "pending" | "in">("rest");
  useEffect(() => {
    const el = ref.current;
    if (!el || !momentOn(moment) || !("IntersectionObserver" in window)) return;
    const below = el.getBoundingClientRect().top > window.innerHeight * 0.9;
    if (hideBelowFold && below) setState("pending");
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setState("in");
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    // Never leave anything hidden: if the browser doesn't report the scroll (e.g. a background tab), show it anyway.
    const safety = hideBelowFold && below ? setTimeout(() => setState((s) => (s === "pending" ? "in" : s)), 8000) : undefined;
    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, [moment, hideBelowFold]);
  return [ref, state] as const;
}

// ---------- 6. Find a mentor: cards rise in, then slide into their new places when the filters change ----------

export function MentorCardsMotion({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<Map<string, { x: number; y: number }>>(new Map());
  const first = useRef(true);
  const ids = Children.toArray(children).map((c) => (isValidElement(c) ? String(c.key) : "")).join("|");

  useIsoLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const on = momentOn("mentorCards");
    const now = new Map<string, { x: number; y: number }>();
    const cards = Array.from(box.querySelectorAll<HTMLElement>(":scope > [data-flip-id]"));
    cards.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const pos = { x: r.left + window.scrollX, y: r.top + window.scrollY };
      now.set(el.dataset.flipId!, pos);
      if (!on) return;
      const was = prev.current.get(el.dataset.flipId!);
      if (first.current || !was) {
        el.animate(
          [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }],
          { duration: 450, delay: Math.min(i, 6) * 80, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }
        );
      } else if (Math.abs(was.x - pos.x) > 1 || Math.abs(was.y - pos.y) > 1) {
        el.animate(
          [{ transform: `translate(${was.x - pos.x}px, ${was.y - pos.y}px)` }, { transform: "none" }],
          { duration: 450, easing: "cubic-bezier(.2,.8,.2,1)" }
        );
      }
    });
    prev.current = now;
    first.current = false;
  }, [ids]);

  return (
    <div ref={ref} className={MOMENTS.mentorCards ? "mm-cards" : undefined} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

// ---------- 7. Mentor profile: five stars that fill in one at a time ----------

const STAR = "M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9L2.1 9.6l7-.7z";

export function StarsFill({ avg, count }: { avg: number; count: number }) {
  const [play, setPlay] = useState(false);
  useEffect(() => setPlay(momentOn("profileStars")), []);
  return (
    <span className={`mm-stars${play ? " mm-play" : ""}`} style={{ fontSize: 15 }}>
      <span className="mm-stars-row" role="img" aria-label={`${avg.toFixed(1)} out of 5 stars`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const f = Math.max(0, Math.min(1, avg - i));
          return (
            <svg key={i} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ ["--i" as string]: i, ["--f" as string]: `${Math.round(f * 100)}%` }}>
              <path className="bg" d={STAR} />
              <path className="fg" d={STAR} />
            </svg>
          );
        })}
      </span>{" "}
      <b>{avg.toFixed(1)}</b> <span className="text-secondary">({count})</span>
    </span>
  );
}

// ---------- 2. Checkout success: a card that flips in, with confetti ----------

export function JustPaidMoment({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!momentOn("checkout")) return;
    setPlay(true);
    const t = setTimeout(() => burstFrom(ref.current, BIG), 450);
    return () => clearTimeout(t);
  }, []);
  return (
    <div ref={ref} className={play ? "mm-flip-in" : undefined}>
      {children}
    </div>
  );
}

// ---------- 3. Results: confetti from a new acceptance's badge ----------

export function celebrateBadge(el: Element | null) {
  if (!el || !momentOn("acceptance")) return;
  el.classList.remove("mm-pop");
  void (el as HTMLElement).offsetWidth;
  el.classList.add("mm-pop");
  setTimeout(() => burstFrom(el, SMALL), 250);
  setTimeout(() => burstFrom(el, { ...SMALL, count: 40, speed: 6 }), 450);
}

// ---------- 4. Mentor invite accepted: a badge slides onto a white coat ----------

export function MentorWelcome() {
  const [play, setPlay] = useState(false);
  useEffect(() => setPlay(momentOn("mentorWelcome")), []);
  if (!MOMENTS.mentorWelcome) return null;
  return (
    <div className={`mm-coat-wrap${play ? " mm-play" : ""}`} aria-hidden="true">
      <div className="mm-coat">
        <span className="mm-coat-badge">MentorsMD Mentor</span>
      </div>
    </div>
  );
}

// ---------- 5. Payouts: a new paid payout counts up, with a green check ----------

const SEEN_KEY = "mmd-paid-payouts-seen";

export function PaidTotal({ cents, paidIds }: { cents: number; paidIds: string[] }) {
  const [shown, setShown] = useState(cents);
  const [check, setCheck] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const key = paidIds.join(",");

  useEffect(() => {
    setShown(cents);
    if (!paidIds.length) return;
    let seen: string[] | null = null;
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "null");
      localStorage.setItem(SEEN_KEY, JSON.stringify(paidIds));
    } catch {
      return;
    }
    // First visit on this browser with payouts already made: remember them quietly, unless it's the very first payout.
    const fresh = seen ? paidIds.filter((id) => !seen!.includes(id)) : paidIds.length === 1 ? paidIds : [];
    if (!fresh.length || !momentOn("payout")) return;
    let raf = 0;
    const t0 = performance.now() + 250, dur = 1200;
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      setShown(Math.round(cents * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        setCheck(true);
        burstFrom(ref.current, SMALL);
      }
    };
    setShown(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className="stat-num mm-paid" ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {money(shown)}
      {check && (
        <svg className="mm-check" viewBox="0 0 44 44" width="28" height="28" aria-hidden="true">
          <circle cx="22" cy="22" r="20" />
          <path d="M13 23l6 6 12-13" />
        </svg>
      )}
    </span>
  );
}

// ---------- 11. Call page: a ring that fills during the last hour before Join opens ----------

export function JoinCountdown({ opensAt, now }: { opensAt: Date; now: Date }) {
  if (!MOMENTS.joinCountdown) return null;
  const left = opensAt.getTime() - now.getTime();
  const HOUR = 3600_000;
  if (left > HOUR) return null;
  const done = left <= 0;
  const p = done ? 1 : 1 - left / HOUR;
  const mins = Math.ceil(left / 60_000);
  const C = 2 * Math.PI * 30;
  return (
    <div className={`mm-countdown${done ? " is-open" : ""}`}>
      <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
        <circle className="t" cx="36" cy="36" r="30" />
        <circle className="p" cx="36" cy="36" r="30" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - p) }} />
      </svg>
      <span role="status">
        <b>{done ? "Your room is open" : `Join opens in ${mins} min`}</b>
        <span className="text-muted small">{done ? "Join when you're ready." : "This ring fills as it gets close."}</span>
      </span>
    </div>
  );
}

// ---------- 13. Gift claim: a gift box that opens ----------

export function GiftOpen({ label }: { label: string }) {
  const [play, setPlay] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!momentOn("giftOpen")) return;
    setPlay(true);
    const t = setTimeout(() => burstFrom(ref.current, SMALL), 1100);
    return () => clearTimeout(t);
  }, []);
  if (!MOMENTS.giftOpen) return null;
  return (
    <div ref={ref} className={`mm-gift${play ? " mm-play" : ""}`} aria-hidden="true">
      <div className="mm-gift-note">{label}</div>
      <div className="mm-gift-box" />
      <div className="mm-gift-lid" />
    </div>
  );
}

// ---------- 12. Student and mentor areas: the page fades up when moving between sidebar pages ----------

export function usePageFade(ref: React.RefObject<HTMLElement | null>, pathname: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!momentOn("pageFade") || !ref.current?.animate) return;
    ref.current.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
  }, [pathname, ref]);
}
