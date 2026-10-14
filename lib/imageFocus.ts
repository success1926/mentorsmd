// Photo focus point for Admin -> Website photos. The point an admin clicks
// ("the important part of the photo") is saved on the image address itself,
// e.g. /images/team/stephen.jpg#fp=50,0, so every place that shows the
// photo can keep that part in view when the photo is cropped.

export type Focus = { x: number; y: number };

export function parseFocus(url?: string | null): Focus | null {
  const hash = (url ?? "").split("#")[1];
  if (!hash) return null;
  const fp = new URLSearchParams(hash).get("fp");
  if (!fp) return null;
  const [x, y] = fp.split(",").map(Number);
  const ok = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
  return ok(x) && ok(y) ? { x, y } : null;
}

export function withFocus(url: string, f: Focus | null): string {
  const base = stripFocus(url);
  if (!base || !f) return base;
  return `${base}#fp=${Math.round(f.x)},${Math.round(f.y)}`;
}

export function stripFocus(url?: string | null): string {
  return (url ?? "").split("#")[0];
}

// CSS object-position (or background-position) for a photo, with the
// spot's own fallback when no focus point was picked.
export function focusPosition(url?: string | null, fallback = "50% 50%"): string {
  const f = parseFocus(url);
  return f ? `${f.x}% ${f.y}%` : fallback;
}
