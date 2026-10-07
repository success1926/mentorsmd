import { isOurBlobUrl } from "@/lib/validate";

// Shared by the "Mark work as complete" form and its API route, so the
// browser and the server agree on the rules.
export const DELIVERY_MIN_CHARS = 20;
export const DELIVERY_MAX_CHARS = 5000;
export const DELIVERY_MAX_FILES = 10;

export type DeliveryFile = { url: string; name: string };

// Returns the cleaned-up delivery, or an error message for the person.
export function parseDelivery(body: any): { description: string; files: DeliveryFile[] } | { error: string } {
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
    // Only files we stored ourselves via /api/upload.
    if (!f || !isOurBlobUrl(f.url)) return { error: "One of the files wasn't uploaded correctly. Remove it and try again." };
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
