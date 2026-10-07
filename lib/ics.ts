// Builds the .ics calendar invite attached to call emails. Opening it (or
// Gmail/Outlook reading it automatically) adds the call to the person's
// calendar; a reschedule sends the same UID with a higher SEQUENCE so the
// event moves, and a cancel sends METHOD:CANCEL so it's removed.

export function icsEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function icsStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Lines longer than 75 octets must be folded.
function fold(line: string) {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? " " : "") + line.slice(i, i + 73));
  return parts.join("\r\n");
}

export function buildCallIcs(opts: {
  bookingId: string;
  method: "REQUEST" | "CANCEL";
  sequence: number;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  url: string;
  organizerEmail: string;
  attendees: { name: string; email: string }[];
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MentorsMD//Calls//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method}`,
    "BEGIN:VEVENT",
    `UID:call-${opts.bookingId}-invite@mentorsmd`,
    `SEQUENCE:${opts.sequence}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(opts.start)}`,
    `DTEND:${icsStamp(opts.end)}`,
    `SUMMARY:${icsEscape(opts.summary)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
    `LOCATION:${icsEscape(opts.url)}`,
    `URL:${opts.url}`,
    `ORGANIZER;CN=MentorsMD:mailto:${opts.organizerEmail}`,
    ...opts.attendees.map(
      (a) => `ATTENDEE;CN=${icsEscape(a.name).replace(/:/g, "")};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${a.email}`
    ),
    `STATUS:${opts.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
