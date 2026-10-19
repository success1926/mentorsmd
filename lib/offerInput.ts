// Checks an hour bundle or specialized package sent by the "Rate & offers"
// page (POST /api/gigs, PATCH /api/gigs/[id]). Prices are never typed in:
// they're the hours times a per-hour rate (lib/pricing.ts). Due dates,
// number of calls, call length and turnaround are gone since the Oct 2026
// redesign. Server only (it checks the cover photo's storage path).
import {
  FORMATS,
  GIG_DESCRIPTION_MIN_WORDS,
  PACKAGE_MAX_MINUTES,
  PACKAGE_MIN_MINUTES,
  RATE_RULE,
  SERVICES,
  SERVICE_OTHER_MAX,
  SERVICE_OTHER_MIN,
  categoryForService,
  countWords,
  isValue,
} from "@/lib/options";
import { LIMITS, isNonEmptyString } from "@/lib/validate";
import { hoursLabel, parseRateDollars } from "@/lib/pricing";
import { isOurPath, publicPathFromUrl } from "@/lib/storage";
import { parseFocus, stripFocus, withFocus } from "@/lib/imageFocus";

export const BUNDLE_MIN_HOURS = 2;
export const BUNDLE_MAX_HOURS = 40;

export type OfferData = {
  kind: "BUNDLE" | "SPECIALIZED";
  title: string;
  description: string;
  minutes: number;
  rateCents: number | null;
  format: string;
  service: string | null;
  serviceOther: string | null;
  coverUrl: string | null;
  category: ReturnType<typeof categoryForService>;
  duration: string;
};

type Current = {
  kind: string | null;
  title: string;
  description: string;
  minutes: number | null;
  rateCents: number | null;
  format: string | null;
  service: string | null;
  serviceOther: string | null;
  coverUrl: string | null;
};

// A cover photo must be one this mentor uploaded (public-media, covers/).
// The focus point after "#" is kept.
function cleanCover(value: unknown, mentorId: string): string | null | "bad" {
  if (value === null || value === "" || value === undefined) return null;
  if (typeof value !== "string" || value.length > 700) return "bad";
  const path = publicPathFromUrl(stripFocus(value));
  if (!path || !isOurPath(path, "covers", mentorId)) return "bad";
  return withFocus(stripFocus(value), parseFocus(value));
}

// "Optional own rate": empty = use the hourly rate.
function optionalRate(value: unknown): number | null | "bad" {
  if (value === null || value === undefined || value === "") return null;
  const cents = parseRateDollars(value);
  return cents === null ? "bad" : cents;
}

export function parseOffer(body: any, mentorId: string, current?: Current): { data: OfferData } | { error: string } {
  const kind = current?.kind ?? body.kind;
  if (kind !== "BUNDLE" && kind !== "SPECIALIZED") return { error: "Choose an hour bundle or a specialized package" };
  const pick = <K extends keyof Current>(k: K) => (body[k] !== undefined ? body[k] : current?.[k]);

  // body.rate is in dollars ("" = use the hourly rate); unchanged otherwise.
  const rateCents = body.rate !== undefined ? optionalRate(body.rate) : current?.rateCents ?? null;
  if (rateCents === "bad") return { error: RATE_RULE };

  if (kind === "BUNDLE") {
    const hours = body.hours !== undefined ? Number(body.hours) : (current?.minutes ?? 0) / 60;
    if (!Number.isInteger(hours) || hours < BUNDLE_MIN_HOURS || hours > BUNDLE_MAX_HOURS) {
      return { error: `A bundle is ${BUNDLE_MIN_HOURS} to ${BUNDLE_MAX_HOURS} whole hours` };
    }
    const minutes = hours * 60;
    return {
      data: {
        kind,
        title: `${hoursLabel(minutes)} bundle`,
        description: `${hoursLabel(minutes)} to use for calls, written feedback or both, at your own pace. No due date.`,
        minutes,
        rateCents,
        // Bundle hours work for calls and written work alike.
        format: "WRITTEN_CALL",
        service: null,
        serviceOther: null,
        coverUrl: null,
        category: "OTHER",
        duration: "",
      },
    };
  }

  // Specialized package.
  const title = pick("title");
  const description = pick("description");
  if (!isNonEmptyString(title, LIMITS.gigTitle)) return { error: `Give the package a title (up to ${LIMITS.gigTitle} characters)` };
  if (!isNonEmptyString(description, LIMITS.gigDescription)) return { error: "Say what's included" };
  if (countWords(description) < GIG_DESCRIPTION_MIN_WORDS) return { error: `Describe what's included in at least ${GIG_DESCRIPTION_MIN_WORDS} words` };

  const hours = body.hours !== undefined ? Number(body.hours) : (current?.minutes ?? 0) / 60;
  const minutes = Math.round(hours * 60);
  if (!Number.isFinite(hours) || minutes % 30 !== 0 || minutes < PACKAGE_MIN_MINUTES || minutes > PACKAGE_MAX_MINUTES) {
    return { error: `Estimated hours: ${PACKAGE_MIN_MINUTES / 60} to ${PACKAGE_MAX_MINUTES / 60}, in half-hour steps` };
  }
  const format = pick("format");
  if (!isValue(FORMATS, format)) return { error: "Choose the format: calls only, written only, or calls + written" };

  // Optional topic, so students filtering by service find it.
  const service = pick("service") || null;
  if (service !== null && !isValue(SERVICES, service)) return { error: "Choose a topic from the list" };
  let serviceOther: string | null = null;
  if (service === "OTHER") {
    const raw = pick("serviceOther");
    serviceOther = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
    if (!serviceOther || serviceOther.length < SERVICE_OTHER_MIN || serviceOther.length > SERVICE_OTHER_MAX) {
      return { error: `Name the topic in ${SERVICE_OTHER_MIN} to ${SERVICE_OTHER_MAX} characters, e.g. "CASPer prep"` };
    }
  }

  const coverUrl = cleanCover(pick("coverUrl"), mentorId);
  if (coverUrl === "bad") return { error: "Upload the cover photo again" };

  return {
    data: {
      kind,
      title: title.trim(),
      description: description.trim(),
      minutes,
      rateCents,
      format,
      service,
      serviceOther,
      coverUrl,
      category: service ? categoryForService(service) : "OTHER",
      duration: "",
    },
  };
}
