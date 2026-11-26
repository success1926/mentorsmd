// Shared by the "Mark work as complete" form and its API route, so the
// browser and the server agree on the rules.
export const DELIVERY_MIN_CHARS = 20;
export const DELIVERY_MAX_CHARS = 5000;
export const DELIVERY_MAX_FILES = 10;

// `url` holds the file's private storage path (lib/storage.ts), or an old
// Vercel Blob address for deliveries made before Oct 2026. The field keeps
// its old name so existing deliveries read the same way.
export type DeliveryFile = { url: string; name: string };

// Delivery.files is stored as JSON; read it back safely.
export function deliveryFiles(value: unknown): DeliveryFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((f: any) => f && typeof f.url === "string").map((f: any) => ({ url: f.url, name: String(f.name || "File") }));
}

// Where a delivery file is downloaded from: the route checks the person is
// on the order (or an admin) first.
export const deliveryFileHref = (deliveryId: string, index: number) => `/api/files/delivery/${deliveryId}/${index}`;
