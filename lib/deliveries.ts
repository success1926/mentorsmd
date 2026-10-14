// Shared by the "Mark work as complete" form and its API route, so the
// browser and the server agree on the rules.
export const DELIVERY_MIN_CHARS = 20;
export const DELIVERY_MAX_CHARS = 5000;
export const DELIVERY_MAX_FILES = 10;

// `url` holds the file's private storage path (lib/storage.ts), or an old
// Vercel Blob address for deliveries made before Oct 2026. The field keeps
// its old name so existing deliveries read the same way.
export type DeliveryFile = { url: string; name: string };

// Returns the cleaned-up delivery, or an error message for the person.
// `isOurFile` says whether a file path is one the mentor uploaded (the API
// route passes isOurPath from lib/storage.ts; this file is also used in the
// browser, so it doesn't import storage code itself).
export function parseDelivery(body: any, isOurFile: (path: unknown) => boolean): { description: string; files: DeliveryFile[] } | { error: string } {
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (description.length < DELIVERY_MIN_CHARS) {
    return { error: `Describe what you're delivering (at least ${DELIVERY_MIN_CHARS} characters).` };
  }
  if (description.length > DELIVERY_MAX_CHARS) {
    return { error: `The description is too long (${DELIVERY_MAX_CHARS} characters max).` };
  }
  const raw = body?.files ?? [];
  if (!Array.isArray(raw)) return { error: "Invalid files" };
  if (raw.length > DELIVERY_MAX_FILES) return { error: `You can attach up to ${DELIVERY_MAX_FILES} files.` };
  const files: DeliveryFile[] = [];
  for (const f of raw) {
    // Only files the mentor uploaded themselves via /api/upload.
    if (!f || !isOurFile(f.url)) return { error: "One of the files wasn't uploaded correctly. Remove it and try again." };
    const name = typeof f.name === "string" && f.name.trim() ? f.name.trim().slice(0, 150) : "File";
    files.push({ url: f.url, name });
  }
  return { description, files };
}

// Delivery.files is stored as JSON; read it back safely.
export function deliveryFiles(value: unknown): DeliveryFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((f: any) => f && typeof f.url === "string").map((f: any) => ({ url: f.url, name: String(f.name || "File") }));
}

// Where a delivery file is downloaded from: the route checks the person is
// on the order (or an admin) first.
export const deliveryFileHref = (deliveryId: string, index: number) => `/api/files/delivery/${deliveryId}/${index}`;
