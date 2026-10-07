// Small presentational pieces shared across pages. No hooks, so these
// work in both server and client components.

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

export function Rating({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) return <span className="badge badge-brand">New mentor</span>;
  return (
    <span style={{ fontSize: 15 }}>
      <span className="stars">★</span> <b>{avg.toFixed(1)}</b> <span className="text-secondary">({count})</span>
    </span>
  );
}

const TINTS = ["#F1EDFF", "#FCE4EC", "#E4EEFF", "#DDD5FF"];
export function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function initialsOf(name: string) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Order status as the student/mentor sees it.
export function statusBadge(order: { status: string; disputed?: boolean; callHoldAt?: any; workCompletedAt?: any }) {
  if (order.disputed && ["IN_ESCROW", "COMPLETED"].includes(order.status)) return <span className="badge badge-danger">Disputed</span>;
  switch (order.status) {
    case "PENDING_PAYMENT":
      return <span className="badge">Awaiting payment</span>;
    case "IN_ESCROW":
      return order.callHoldAt ? <span className="badge badge-warning">On hold: call not booked</span> : <span className="badge badge-brand">In progress</span>;
    case "COMPLETED":
      return <span className="badge badge-blue">Delivered: in review</span>;
    case "RELEASED":
      return <span className="badge badge-success">Complete</span>;
    case "REFUNDED":
      return <span className="badge badge-pink">Refunded</span>;
    case "CANCELLED":
      return <span className="badge">Cancelled</span>;
    default:
      return <span className="badge">{order.status}</span>;
  }
}
