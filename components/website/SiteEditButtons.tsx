"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

// Click-to-edit for admins. On the pages edited in Admin -> Website, hovering
// a section outlines it and shows "Edit [section]", which opens that page's
// editor at that section. Inside the editor's own preview panel the click is
// passed to the editor next to it (postMessage) instead of leaving the page.
//
// Visitors never get any of this: it only switches on after the server says
// this browser's login is an admin with the Website permission
// (/api/admin/me), and the browser only asks when the session is an admin's.
// On the live site a small pill turns the buttons off (remembered on this device).
//
// Sections are found through the invisible markers that
// components/website/PageSections.tsx puts before each one.

type Zone = { top: number; left: number; width: number; height: number; label: string; page: string; section: string };
const OFF_KEY = "mmd-edit-buttons-off";
export const EDIT_MESSAGE = "mmd-site-edit";

export function SiteEditButtons() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const path = usePathname() || "/";
  const [allowed, setAllowed] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [off, setOff] = useState(false);
  const [hasSections, setHasSections] = useState(false);
  const [zone, setZone] = useState<Zone | null>(null);
  const target = useRef<Element | null>(null);
  const tick = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top && window.parent.location.pathname.startsWith("/admin/website"));
    } catch {}
    try {
      setOff(localStorage.getItem(OFF_KEY) === "1");
    } catch {}
  }, []);

  // Server check (only for admin sessions; everyone else never asks).
  useEffect(() => {
    if (role !== "ADMIN") {
      setAllowed(false);
      return;
    }
    let live = true;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { website: false }))
      .then((j) => live && setAllowed(!!j.website))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [role]);

  useEffect(() => {
    setZone(null);
    setHasSections(!path.startsWith("/admin") && !!document.querySelector("[data-edit-sec]"));
  }, [path, allowed]);

  const active = allowed && hasSections && (embedded || !off);

  useEffect(() => {
    if (!active) {
      setZone(null);
      return;
    }
    const measure = () => {
      tick.current = undefined;
      const t = target.current;
      if (!t || (t as HTMLElement).closest?.(".site-edit-ui")) return;
      setZone(zoneFor(t));
    };
    const later = () => {
      if (tick.current === undefined) tick.current = window.setTimeout(measure, 40);
    };
    const onMove = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.(".site-edit-ui")) return;
      target.current = e.target as Element;
      later();
    };
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        target.current = null;
        setZone(null);
      }
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseout", onLeave);
    window.addEventListener("scroll", later, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("scroll", later);
      window.clearTimeout(tick.current);
      tick.current = undefined;
    };
  }, [active]);

  if (!allowed || !hasSections) return null;

  const toggle = () => {
    const next = !off;
    setOff(next);
    try {
      localStorage.setItem(OFF_KEY, next ? "1" : "0");
    } catch {}
  };

  const go = () => {
    if (!zone) return;
    if (embedded) window.parent.postMessage({ type: EDIT_MESSAGE, page: zone.page, section: zone.section }, window.location.origin);
    else window.location.href = `/admin/website/${encodeURIComponent(zone.page)}?section=${encodeURIComponent(zone.section)}`;
  };

  const btnTop = zone ? Math.max(Math.min(zone.top + 12, zone.top + zone.height - 48), embedded ? 8 : 96) : 0;
  return (
    <>
      {active && zone && (
        <>
          <div className="site-edit-ui site-edit-outline no-print" style={{ top: zone.top, left: zone.left, width: zone.width, height: zone.height }} aria-hidden="true" />
          <button type="button" className="site-edit-ui site-edit-btn no-print" style={{ top: btnTop, right: Math.max(12, window.innerWidth - zone.left - zone.width + 12) }} onClick={go}>
            ✎ Edit {zone.label}
          </button>
        </>
      )}
      {!embedded && (
        <div className="site-edit-ui site-edit-pill no-print" role="group" aria-label="Edit buttons for admins">
          <span>{off ? "Edit buttons off" : "Edit buttons on"}</span>
          <button type="button" onClick={toggle}>{off ? "Turn on" : "Turn off"}</button>
          <a href="/admin/website">Website editor</a>
        </div>
      )}
    </>
  );
}

// The section under the pointer: the nearest element whose earlier siblings
// include a section marker, measured together with the marker's other parts.
function zoneFor(t: Element): Zone | null {
  const main = document.querySelector("main");
  if (!main || !main.contains(t)) return null;
  for (let el: Element | null = t; el && el !== main.parentElement; el = el.parentElement) {
    let marker: Element | null = el.previousElementSibling;
    while (marker && !(marker as HTMLElement).dataset?.editSec) marker = marker.previousElementSibling;
    if (!marker) continue;
    const m = (marker as HTMLElement).dataset;
    let l = Infinity, tp = Infinity, r = -Infinity, b = -Infinity;
    for (let sib = marker.nextElementSibling; sib && !(sib as HTMLElement).dataset?.editSec; sib = sib.nextElementSibling) {
      const rect = sib.getBoundingClientRect();
      if (!rect.height) continue;
      l = Math.min(l, rect.left);
      tp = Math.min(tp, rect.top);
      r = Math.max(r, rect.right);
      b = Math.max(b, rect.bottom);
    }
    if (!isFinite(tp)) return null;
    return { top: tp, left: l, width: r - l, height: b - tp, label: m.editLabel || "section", page: m.editPage || "", section: m.editSec || "" };
  }
  return null;
}
