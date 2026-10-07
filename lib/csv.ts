// CSV downloads for the admin pages (#84). Values that a spreadsheet
// would run as a formula are prefixed with ' so they show as plain text.

export function csvCell(v: unknown) {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvBody(header: string[], rows: unknown[][]) {
  return [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}

// The byte-order mark makes Excel read accented names correctly.
export function csvResponse(filename: string, body: string) {
  return new Response("\uFEFF" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      "Cache-Control": "no-store",
    },
  });
}
