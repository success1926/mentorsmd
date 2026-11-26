// The small date block at the start of a call row: weekday (or "Today"),
// the day of the month, the month. Shown in the viewer's time zone.
const isToday = (d: Date) => d.toDateString() === new Date().toDateString();

export function DateBadge({ d }: { d: Date }) {
  return (
    <span className="cal-date" aria-hidden="true">
      <span className="small text-secondary">{isToday(d) ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" })}</span>
      <b>{d.getDate()}</b>
      <span className="small text-muted">{d.toLocaleDateString("en-US", { month: "short" })}</span>
    </span>
  );
}
