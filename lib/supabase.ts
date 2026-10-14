import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase (server side only): file storage and live updates.
//
//  - NEXT_PUBLIC_SUPABASE_URL      the project address (also used in the browser)
//  - SUPABASE_SERVICE_ROLE_KEY     secret key; creates upload/download links and sends live updates
//  - SUPABASE_JWT_SECRET           secret; signs the short-lived live-update tokens (lib/realtime.ts)
//
// Nothing here runs when a module loads, so a build (or a preview without
// the keys) never crashes: features that need Supabase just report that
// they aren't set up.

// Preview deployments share the same Supabase project as the live site, so
// every file path and live-update topic starts with "live" or "preview".
// Tests on a preview never touch real files or reach real people.
export const ENV_TAG = process.env.VERCEL_ENV === "production" ? "live" : "preview";

// Only the project origin is used, so a pasted ".../rest/v1/" address still works.
export function supabaseOrigin(raw: string | undefined): string {
  try {
    return raw ? new URL(raw).origin : "";
  } catch {
    return "";
  }
}

export const SUPABASE_URL = supabaseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);

let admin: SupabaseClient | null | undefined;

// The server's own Supabase client (full access). Null when not set up.
export function supabaseAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  admin = SUPABASE_URL && key ? createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return admin;
}

export const NOT_SET_UP = "File uploads aren't set up yet. Please try again later.";
