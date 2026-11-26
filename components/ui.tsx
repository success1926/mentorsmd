// Small presentational pieces shared across pages. No hooks, so these
// work in both server and client components. Use these instead of
// building the same thing by hand (styles in app/globals.css).
import Link from "next/link";
import { cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { orderStatus, statusClass, type StatusAudience, type StatusOrderLike } from "@/lib/statusLabels";
import { initialsOf as initialsOfName } from "@/lib/format";

export function Icon({ d, size = 20, stroke = 2 }: { d: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  shield: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9 12l2 2 4-4",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5M9 14l2 2 4-4",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  pen: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  chat: "M4 5h16v11H9l-5 4V5z",
  chart: "M5 20V10M12 20V4M19 20v-7",
  cycle: "M4 12a8 8 0 0114-5l2 2M20 4v5h-5M20 12a8 8 0 01-14 5l-2-2M4 20v-5h5",
  lock: "M6 10h12v11H6zM8 10V7a4 4 0 018 0v3",
  calendar: "M4 6h16v15H4zM4 10h16M9 3v4M15 3v4",
  video: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
  x: "M6 6l12 12M18 6L6 18",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  pause: "M8 5v14M16 5v14",
  alert: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5v5.5M12 16.5v.01",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  chevron: "M6 9l6 6 6-6",
  back: "M19 12H5M11 6l-6 6 6 6",
};

export function Vetted() {
  return (
    <span className="vetted">
      <Icon d={ICONS.check} size={13} stroke={2.8} />
      Vetted
    </span>
  );
}

// Shown next to messages from MentorsMD admins. Names like "Admin" or
// "MentorsMD Support" are reserved (lib/reservedNames.ts), so this badge
// is the only way staff can be recognized.
export function StaffBadge() {
  return (
    <span className="staff-badge" title="Official MentorsMD team member">
      <Icon d={ICONS.shield} size={12} stroke={2.4} />
      MentorsMD staff
    </span>
  );
}

// Shown to mentors next to a student who is under 18 (#110).
export function MinorBadge({ person }: { person?: { minorStatus?: string | null } | null }) {
  if (!person?.minorStatus) return null;
  return (
    <span className="badge badge-warning" title="This student is under 18. Keep everything on MentorsMD: sharing contact details is a high-severity safety issue.">
      Under 18
    </span>
  );
}

export function Rating({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) return <span className="badge badge-brand">New mentor</span>;
  return <Stars value={avg} count={count} compact />;
}

// Star rating. compact: one star + "4.9 (12)"; otherwise five stars.
export function Stars({ value, count, compact, showValue = true }: { value: number; count?: number; compact?: boolean; showValue?: boolean }) {
  const full = Math.round(Math.max(0, Math.min(5, value)));
  return (
    <span className="stars-row" aria-label={`${value.toFixed(1)} out of 5 stars${count != null ? `, ${count} review${count === 1 ? "" : "s"}` : ""}`}>
      <span aria-hidden="true">
        {compact ? (
          <span className="stars">★</span>
        ) : (
          <>
            <span className="stars">{"★".repeat(full)}</span>
            <span className="stars stars-off">{"★".repeat(5 - full)}</span>
          </>
        )}
      </span>
      {showValue && <b aria-hidden="true">{value.toFixed(1)}</b>}
      {count != null && <span className="text-secondary" aria-hidden="true">({count})</span>}
    </span>
  );
}

// The soft background colours used behind avatars, cards and pictures.
export const TINTS = ["#F1EDFF", "#FCE4EC", "#E4EEFF", "#DDD5FF"];
export function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export const initialsOf = (name: string) => initialsOfName(name);

// A person's photo, or their initials on a tint. Without a size it uses the
// .avatar default; fontSize is for small ones (initials only).
export function PersonAvatar({ person, size, fontSize }: { person: { id?: string; name?: string | null; photoUrl?: string | null } | null | undefined; size?: number; fontSize?: number }) {
  const box = size ? { width: size, height: size } : {};
  return person?.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.photoUrl} alt="" className="avatar" style={{ ...box, objectFit: "cover" }} />
  ) : (
    <span className="avatar" style={{ ...box, ...(fontSize ? { fontSize } : {}), background: tintFor(person?.id || person?.name || "") }}>{initialsOf(person?.name || "")}</span>
  );
}

// Order status badge. Wording and colours come from lib/statusLabels.ts,
// so student, mentor and admin pages always agree.
export function StatusBadge({ order, audience = "student" }: { order: StatusOrderLike; audience?: StatusAudience }) {
  const st = orderStatus(order, audience);
  return <span className={statusClass(st)}>{st.label}</span>;
}
export const statusBadge = (order: StatusOrderLike, audience: StatusAudience = "student") => <StatusBadge order={order} audience={audience} />;

// A section that opens and closes. Built on <details>, so it works without
// JavaScript and the keyboard opens it. `name` makes a group where only one
// is open at a time. count shows as a small pill after the title.
export function Collapsible({
  title,
  count,
  meta,
  defaultOpen,
  variant = "card",
  name,
  id,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  count?: number | null;
  meta?: ReactNode;
  defaultOpen?: boolean;
  variant?: "card" | "row" | "inline";
  name?: string;
  id?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const nameProp = name ? ({ name } as Record<string, string>) : {};
  return (
    <details className={`collapse${variant === "card" ? "" : ` collapse-${variant}`}${className ? ` ${className}` : ""}`} open={defaultOpen || undefined} id={id} {...nameProp}>
      <summary>
        <span className="collapse-title">
          {title}
          {count != null && <span className="tab-count">{count}</span>}
        </span>
        {meta && <span className="collapse-meta">{meta}</span>}
      </summary>
      <div className={`collapse-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
    </details>
  );
}

// The top of a signed-in page: back link, title, a short line, buttons.
export function PageHeader({ title, lede, actions, back, eyebrow }: { title: ReactNode; lede?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; eyebrow?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && (
          <Link href={back.href} className="back-link">
            <Icon d={ICONS.back} size={16} /> {back.label}
          </Link>
        )}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

// The heading block of a public-page section: small label, heading, lede.
export function SectionHead({ eyebrow, title, lede, center, as: Tag = "h2", titleClassName = "section-title" }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; center?: boolean; as?: "h1" | "h2" | "h3"; titleClassName?: string }) {
  return (
    <div className={`section-head-block${center ? " is-center" : ""}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <Tag className={titleClassName}>{title}</Tag>
      {lede && <p className="lede">{lede}</p>}
    </div>
  );
}

// Nothing to show yet.
export function EmptyState({ title, children, action }: { title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {title && <div className="empty-title">{title}</div>}
      {children && <div>{children}</div>}
      {action}
    </div>
  );
}

// An inline message. Errors are announced to screen readers.
export function Alert({ tone = "info", children, className, style }: { tone?: "info" | "success" | "warning" | "danger" | "blue"; children: ReactNode; className?: string; style?: CSSProperties }) {
  const cls = tone === "info" ? "alert" : `alert alert-${tone}`;
  return (
    <div className={`${cls}${className ? ` ${className}` : ""}`} role={tone === "danger" ? "alert" : "status"} style={style}>
      {children}
    </div>
  );
}

// A tinted box with a title, text and an optional button.
export function Callout({ title, children, action, tone = "tint" }: { title?: ReactNode; children?: ReactNode; action?: ReactNode; tone?: "tint" | "blue" | "pink" }) {
  return (
    <div className={`callout${tone === "tint" ? "" : ` is-${tone}`}`}>
      {title && <div className="callout-title">{title}</div>}
      {children && <div className="text-secondary">{children}</div>}
      {action}
    </div>
  );
}

// A form field: label, the input, help text and an error. Pass the input as
// the only child; it gets its id, aria-invalid and aria-describedby here.
export function Field({ id, label, help, error, optional, children }: { id: string; label: ReactNode; help?: ReactNode; error?: ReactNode; optional?: boolean; children: ReactNode }) {
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errId].filter(Boolean).join(" ") || undefined;
  const input = isValidElement(children) ? cloneElement(children as ReactElement<any>, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy }) : children;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {optional && <span className="field-optional"> (optional)</span>}
      </label>
      {input}
      {help && <span className="field-help" id={helpId}>{help}</span>}
      {error && <span className="field-error" id={errId}>{error}</span>}
    </div>
  );
}

// "Saving…" / "Saved" / an error, shown next to a switch or Save button.
export function SaveStatus({ state, error }: { state: "idle" | "saving" | "saved" | "error"; error?: string }) {
  if (state === "idle") return null;
  if (state === "saving") return <span className="save-status" role="status">Saving…</span>;
  if (state === "saved") return <span className="save-status is-saved" role="status"><Icon d={ICONS.check} size={14} stroke={2.6} /> Saved</span>;
  return <span className="save-status is-error" role="alert">{error || "Couldn't save. Try again."}</span>;
}

// Grey placeholder lines while a page loads, roughly the shape of the page.
export function LoadingBlock({ lines = 3, title = true, cards = 0, label = "Loading…" }: { lines?: number; title?: boolean; cards?: number; label?: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      {title && <div className="skeleton-line is-title" />}
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${[92, 78, 64, 85, 70][i % 5]}%` }} />
      ))}
      {Array.from({ length: cards }, (_, i) => (
        <div key={`c${i}`} className="skeleton-line skeleton-card" />
      ))}
    </div>
  );
}
