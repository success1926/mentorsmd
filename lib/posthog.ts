import { unstable_cache } from "next/cache";

// Reads visitor numbers from PostHog for Admin -> Analytics (server only).
// Needs POSTHOG_PERSONAL_API_KEY (PostHog -> Settings -> Personal API keys,
// read-only "Query" scope, limited to the MentorsMD project) and
// POSTHOG_PROJECT_ID. Results are kept for 5 minutes so opening the page
// again doesn't re-run every query.

const APP_HOST = "https://us.posthog.com";
const host = () => (process.env.POSTHOG_API_HOST || APP_HOST).replace(/\/$/, "");
const projectId = () => (process.env.POSTHOG_PROJECT_ID || "").trim();

export const posthogReady = () => !!process.env.POSTHOG_PERSONAL_API_KEY && /^\d+$/.test(projectId());
export const posthogTrackingOn = () => !!process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Links into the PostHog app.
export const posthogProjectUrl = () => `${host()}/project/${projectId() || "664808"}`;
export const posthogReplayUrl = () => `${posthogProjectUrl()}/replay/home`;

const runQuery = unstable_cache(
  async (query: string): Promise<unknown[][]> => {
    const res = await fetch(`${host()}/api/projects/${projectId()}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query }, name: "mentorsmd-admin-analytics" }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      if (res.status === 401 || res.status === 403) throw new Error(`PostHog refused the key (${res.status}). Check POSTHOG_PERSONAL_API_KEY and that it can read the MentorsMD project.`);
      throw new Error(`PostHog said ${res.status}: ${text}`);
    }
    const json = await res.json();
    return (json.results ?? []) as unknown[][];
  },
  ["posthog-hogql"],
  { revalidate: 300 }
);

// Runs one HogQL query. Only ever called with queries built in code (no
// user input apart from a whitelisted number of days).
export async function hogql<T extends unknown[] = unknown[]>(query: string): Promise<T[]> {
  return (await runQuery(query.replace(/\s+/g, " ").trim())) as T[];
}
