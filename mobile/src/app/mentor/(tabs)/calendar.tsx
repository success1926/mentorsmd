import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Btn, Eyebrow, Field, H, Link, LoadError, Loading, Note, Row, Screen, Sec, SecH, Seg, Small, SS, T } from "../../../components/ui";
import { BOOKING_WINDOW_OPTIONS, CallSheet, DayGrid, ErrText, openSite, useConfirm, useReloadOnFocus } from "../../../components/mentorSheets";
import { api, errorText, useApi } from "../../../lib/api";
import { useOverlay } from "../../../lib/overlay";
import { dayString, dayWord, fmtDayString, fmtTime, minutesBetween } from "../../../lib/format";
import { joinState } from "../../../lib/orders";

type CalCall = { id: string; startTime: string; endTime: string; orderId: string | null; title: string; withName: string; kind: string; disputed: boolean };
type Cal = { upcoming: CalCall[] };
type Busy = { id: string; startDay: string; endDay: string; note: string | null };
type Profile = {
  timeZone: string | null; weeklyHours: Record<string, [string, string][]> | null; bufferMinutes: number | null; minNoticeHours: number | null;
  bookingWindowDays: number | null; daysOff: string[] | null; hasAvailability: boolean; googleCal: { email: string | null } | null; externalCal: { host: string } | null;
};

const DAYS: [string, string][] = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date(2000, 0, 1, h || 0, m || 0);
  return fmtTime(d);
};
const tzName = (tz: string | null) => (tz ? tz.replace(/_/g, " ").split("/").pop() : "");

// Calendar & availability: upcoming calls (join, move, cancel), call hours, booking window, busy dates and calendar links.
export default function MentorCalendar() {
  const router = useRouter();
  const { toast, openSheet } = useOverlay();
  const confirm = useConfirm();
  const cal = useApi<Cal>("/api/me/calendar");
  const prof = useApi<{ profile: Profile }>("/api/profile");
  const busy = useApi<{ busyDates: Busy[] }>("/api/profile/busy-dates");
  const reload = useCallback(() => { cal.reload(); prof.reload(); busy.reload(); }, [cal.reload, prof.reload, busy.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnFocus(reload);
  const [saving, setSaving] = useState(false);
  const p = prof.data?.profile;
  const windowDays = p?.bookingWindowDays && BOOKING_WINDOW_OPTIONS.includes(p.bookingWindowDays) ? p.bookingWindowDays : 60;

  const setWindow = async (n: number) => {
    if (!p || saving) return;
    setSaving(true);
    try {
      await api("/api/profile/schedule", {
        method: "PUT",
        body: {
          weeklyHours: p.weeklyHours || {},
          timeZone: p.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
          bufferMinutes: p.bufferMinutes ?? 15,
          minNoticeHours: p.minNoticeHours ?? 24,
          bookingWindowDays: n,
          daysOff: p.daysOff || [],
        },
      });
      prof.setData({ profile: { ...p, bookingWindowDays: n } });
      toast(`Students can book up to ${n === 7 ? "1 week" : n === 14 ? "2 weeks" : `${n} days`} ahead`);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const removeBusy = (b: Busy) =>
    confirm({
      title: "Remove These Busy Dates?",
      body: `${fmtDayString(b.startDay)}${b.endDay !== b.startDay ? ` to ${fmtDayString(b.endDay)}` : ""}. Students can book calls on these days again.`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: async () => {
        const d = await api<{ busyDates: Busy[] }>("/api/profile/busy-dates", { method: "DELETE", body: { id: b.id } });
        busy.setData(d);
        toast("Busy dates removed");
      },
    });

  const upcoming = cal.data?.upcoming || [];
  const busyList = busy.data?.busyDates || [];

  return (
    <Screen>
      <T>Calendar & Availability</T>
      {(cal.loading && !cal.data) || (prof.loading && !prof.data) ? <Loading /> : (
        <>
          <Sec>
            <Eyebrow>Upcoming calls</Eyebrow>
            {cal.error ? <LoadError error={cal.error} onRetry={cal.reload} /> : upcoming.length ? (
              <View>
                {upcoming.map((x, i) => {
                  const open = joinState(x) === "open";
                  return (
                    <Row key={x.id} tt={`${x.withName || "Student"} · ${x.title}`} ss={`${dayWord(x.startTime)} · ${fmtTime(x.startTime)} · ${minutesBetween(x.startTime, x.endTime)} min`}
                      rr={open ? <Btn kind="dark" sm label="Join" onPress={() => router.push(`/call/${x.id}`)} /> : undefined}
                      onPress={() => openSheet(() => <CallSheet call={x} onChanged={cal.reload} />)} last={i === upcoming.length - 1} />
                  );
                })}
              </View>
            ) : <Note>No calls booked yet.</Note>}
            <Small>Tap a call to reschedule or cancel it. The Join button appears 10 minutes before the start.</Small>
          </Sec>

          <Sec>
            <SecH><Eyebrow>Call hours</Eyebrow><Link label="Edit on mentorsmd.com" onPress={() => openSite("/dashboard/availability#call-hours")} /></SecH>
            {prof.error ? <LoadError error={prof.error} onRetry={prof.reload} /> : p ? (
              <>
                {!p.hasAvailability ? <Note>No call hours yet. Set your call hours so students can book the calls in your packages.</Note> : (
                  <View>
                    {DAYS.map(([k, l], i) => {
                      const w = p.weeklyHours?.[k] || [];
                      return <Row key={k} tt={l} rr={w.length ? w.map(([a, b]) => `${clock(a)} – ${clock(b)}`).join(", ") : "Not available"} last={i === DAYS.length - 1} />;
                    })}
                  </View>
                )}
                <Small>{p.timeZone ? `Your time zone: ${tzName(p.timeZone)}. ` : ""}Students see times in their own time zone. Times above are in your time zone.</Small>
              </>
            ) : null}
          </Sec>

          {p ? (
            <Sec>
              <Eyebrow>How far ahead students can book</Eyebrow>
              <Seg options={BOOKING_WINDOW_OPTIONS.map((n) => [n, n === 7 ? "1 wk" : n === 14 ? "2 wks" : `${n} d`] as [number, string])} value={windowDays} onChange={setWindow} />
            </Sec>
          ) : null}

          <Sec>
            <SecH><Eyebrow>Busy dates</Eyebrow><Link label="Add busy dates" onPress={() => openSheet(() => <AddBusySheet onAdded={(d) => busy.setData(d)} />)} /></SecH>
            {busy.error ? <LoadError error={busy.error} onRetry={busy.reload} /> : busy.loading && !busy.data ? <Loading /> : busyList.length ? (
              <View>
                {busyList.map((b, i) => (
                  <Row key={b.id} tt={`${fmtDayString(b.startDay)}${b.endDay !== b.startDay ? ` – ${fmtDayString(b.endDay)}` : ""}`} ss={b.note || undefined} rr="Remove" onPress={() => removeBusy(b)} last={i === busyList.length - 1} />
                ))}
              </View>
            ) : <Note>No busy dates. Add exams, rotations or travel so students can’t book calls on those days.</Note>}
          </Sec>

          {p ? (
            <Sec>
              <Eyebrow>Your calendar</Eyebrow>
              <View>
                <Row tt="Google Calendar" ss={p.googleCal ? `Connected${p.googleCal.email ? ` · ${p.googleCal.email}` : ""}. Busy times there block bookings here.` : "Not connected. Busy times in Google can block bookings here."}
                  onPress={() => openSite("/dashboard/availability#calendar")} />
                <Row tt="Other calendar link" ss={p.externalCal ? `Connected · ${p.externalCal.host}` : "Not connected"} onPress={() => openSite("/dashboard/availability#calendar")} last />
              </View>
              <Small>Connecting a calendar opens mentorsmd.com.</Small>
            </Sec>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function AddBusySheet({ onAdded }: { onAdded: (d: { busyDates: Busy[] }) => void }) {
  const { closeSheet, toast } = useOverlay();
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!start) return setError("Pick the first day.");
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ busyDates: Busy[]; clashes?: { calls: { startTime: string; studentName: string }[] } }>("/api/profile/busy-dates", { body: { startDay: start, endDay: end || start, note: note.trim() || undefined } });
      onAdded(d);
      closeSheet();
      const n = d.clashes?.calls?.length || 0;
      toast(n ? `Saved. ${n} call${n === 1 ? " is" : "s are"} already booked in those days: move ${n === 1 ? "it" : "them"} from Upcoming calls.` : "Busy dates saved");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <H>Add Busy Dates</H>
      <Note>Exams, rotations, travel. Students can’t book calls with you on these days.</Note>
      <DayGrid start={start} end={end} range minDay={dayString(new Date())} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      <SS>{start ? `${fmtDayString(start)}${end && end !== start ? ` to ${fmtDayString(end)}` : " (tap another day for a range)"}` : "Tap the first day, then the last day."}</SS>
      <Field label="Note (only you see it, optional)" value={note} onChange={setNote} placeholder="Step 1 exam" />
      <ErrText>{error}</ErrText>
      <Btn kind="dark" label={busy ? "Saving…" : "Save busy dates"} disabled={busy || !start} onPress={save} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}
