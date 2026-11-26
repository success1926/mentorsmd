"use client";

// One hours package in a list: the other person, the title, the hours-left
// bar, its status and new messages. Used on the student and mentor Home,
// My packages, Students & packages and the Messages side panel, so a
// package looks the same everywhere. Badges: the status (worded for who is
// looking, lib/statusLabels.ts) plus "Running low" when it applies.
// Without `actions` the whole row opens the package page (/orders/[id]).
import Link from "next/link";
import type { ReactNode } from "react";
import { MinorBadge, PersonAvatar, StatusBadge } from "@/components/ui";
import { HoursBar, LowHoursBadge } from "@/components/Packages";
import { hoursSummary, shortHours } from "@/lib/hours";

export function PackageRow({
  p,
  audience,
  actions,
  showCalls = false,
  card = false,
}: {
  p: any;
  audience: "student" | "mentor";
  actions?: ReactNode;
  // Adds "· N calls held" to the hours line.
  showCalls?: boolean;
  // Drawn as its own small card (the Messages side panel).
  card?: boolean;
}) {
  const h = hoursSummary(p);
  const isMentor = audience === "mentor";
  const other = isMentor ? p.buyer : p.seller;
  const title = p.title || p.packageTitle || p.gig?.title || "Package";
  const href = `/orders/${p.id}`;
  const heading = isMentor ? (
    <>
      <span className="row-wrap pkg-entry-name">
        <b>{other?.name || "Student"}</b>
        <MinorBadge person={other} />
      </span>
      <span className="text-secondary small">{title}</span>
    </>
  ) : (
    <>
      <b className="pkg-entry-name">{title}</b>
      <span className="text-muted small">{other?.name}</span>
    </>
  );
  const body = (
    <>
      <PersonAvatar person={other} size={40} fontSize={15} />
      <div className="pkg-entry-main">
        <div className="pkg-entry-top">
          {actions ? (
            <Link href={href} className="pkg-entry-heading">{heading}</Link>
          ) : (
            <span className="pkg-entry-heading">{heading}</span>
          )}
          <span className="pkg-entry-badges">
            <LowHoursBadge order={p} />
            <StatusBadge order={p} audience={audience} />
            {p.newMessages > 0 && <span className="count-badge" aria-label={`${p.newMessages} new message${p.newMessages === 1 ? "" : "s"}`}>{p.newMessages}</span>}
          </span>
        </div>
        <HoursBar order={p} thin />
        <span className="small text-secondary">
          <b>{shortHours(h.left)}</b> left of {shortHours(h.purchased)}
          {showCalls ? ` · ${h.callsHeld} call${h.callsHeld === 1 ? "" : "s"} held` : ""}
        </span>
        {actions && <div className="row-wrap pkg-entry-actions">{actions}</div>}
      </div>
    </>
  );
  const cls = `pkg-entry${card ? " is-card" : ""}`;
  return actions ? <div className={cls}>{body}</div> : <Link href={href} className={cls}>{body}</Link>;
}
