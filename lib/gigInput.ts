import {
  CALL_LENGTHS,
  FORMATS,
  MAX_CALLS,
  SERVICES,
  SERVICE_OTHER_MAX,
  SERVICE_OTHER_MIN,
  TURNAROUNDS,
  categoryForService,
  formatHasCall,
  isValue,
  labelFor,
} from "@/lib/options";

type SearchFields = {
  service: string;
  serviceOther: string | null;
  format: string;
  turnaround: string;
  callsIncluded: number;
  callLength: number | null;
  duration: string;
  category: ReturnType<typeof categoryForService>;
};

// Validates the required search answers on a package. `current` is the
// package as it is now (for edits), so a partial update is checked as a
// whole. Returns either the fields to save or a friendly error.
export function parseGigSearchFields(
  body: any,
  current?: { service: string | null; serviceOther?: string | null; format: string | null; turnaround: string | null; callsIncluded: number; callLength: number | null }
): { data: SearchFields } | { error: string } {
  const service = body.service ?? current?.service;
  const format = body.format ?? current?.format;
  const turnaround = body.turnaround ?? current?.turnaround;

  if (!isValue(SERVICES, service)) return { error: "Choose which service this package is" };

  // "Other" needs a short name for the service, shown as its tag.
  let serviceOther: string | null = null;
  if (service === "OTHER") {
    const raw = body.serviceOther !== undefined ? body.serviceOther : current?.serviceOther;
    serviceOther = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
    if (!serviceOther || serviceOther.length < SERVICE_OTHER_MIN || serviceOther.length > SERVICE_OTHER_MAX) {
      return { error: `Name the service in ${SERVICE_OTHER_MIN} to ${SERVICE_OTHER_MAX} characters, e.g. "CASPer prep"` };
    }
  }
  if (!isValue(FORMATS, format)) return { error: "Choose the format" };
  if (!isValue(TURNAROUNDS, turnaround)) return { error: "Choose the turnaround" };

  let callsIncluded = 0;
  let callLength: number | null = null;
  if (formatHasCall(format)) {
    callsIncluded = Number(body.callsIncluded ?? current?.callsIncluded);
    callLength = Number(body.callLength ?? current?.callLength);
    if (!Number.isInteger(callsIncluded) || callsIncluded < 1 || callsIncluded > MAX_CALLS) {
      return { error: `Choose how many calls are included (1 to ${MAX_CALLS})` };
    }
    if (!CALL_LENGTHS.includes(callLength)) return { error: "Choose the call length" };
  }

  return {
    data: {
      service,
      serviceOther,
      format,
      turnaround,
      callsIncluded,
      callLength,
      duration: labelFor(TURNAROUNDS, turnaround),
      category: categoryForService(service),
    },
  };
}
