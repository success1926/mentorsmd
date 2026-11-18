import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api, ApiError, errorText, SITE } from "../lib/api";
import { useOverlay } from "../lib/demo";
import { fonts, useColors } from "../lib/theme";
import { Btn, Card, Chip, FChip, FChipRow, H, Icon, Link, Note, RowV, Small, TT } from "./ui";

// The mentor side of the app, against the real website (mentorsmd.com).
// Helpers copied from the website's own rules (lib/finishing.ts,
// lib/hours.ts, lib/calls.ts, lib/payoutRules.ts) so the app shows the same
// numbers and wording, plus the small pieces several mentor screens share.

export const FEE_PERCENT = 30; // lib/fee.ts PLATFORM_FEE_PERCENT
export const TOP_UP_HOURS = [1, 2, 3, 5];
export const BUNDLE_HOURS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
export const RATE_RULE = "Rates are whole dollars, at least $50 an hour (up to $2,000)";
export const BOOKING_WINDOW_OPTIONS = [7, 14, 30, 60, 90];
const JOIN_OPENS_MINUTES_BEFORE = 10;
const JOIN_CLOSES_MINUTES_AFTER = 30;
export const CANCEL_CUTOFF_HOURS = 24;
export const LATE_REASON_MIN = 20;
const FREES_THE_CALL = ["MENTOR_NO_SHOW", "FREE_REBOOK"];

// ---------- people and dates ----------
export const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "";
export const initialsOf = (n?: string | null) =>
  (n || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

const asDate = (d: string | Date) => (d instanceof Date ? d : new Date(d));
export const fmtDay = (d: string | Date) => asDate(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const fmtTime = (d: string | Date) => asDate(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export const fmtWhen = (d: string | Date) => asDate(d).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const minutesBetween = (a: string | Date, b: string | Date) => Math.round((asDate(b).getTime() - asDate(a).getTime()) / 60000);

// "Today", "Tomorrow" or "Sat, Nov 21".
export function dayWord(d: string | Date) {
  const x = asDate(d);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const x0 = new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((x0 - t0) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return x.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// "3h", "Yesterday", "Mon", "Nov 2" for message lists.
export function ago(d: string | Date) {
  const x = asDate(d);
  const mins = Math.max(0, Math.round((Date.now() - x.getTime()) / 60000));
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  if (mins < 48 * 60) return "Yesterday";
  if (mins < 7 * 24 * 60) return x.toLocaleDateString(undefined, { weekday: "short" });
  return fmtDay(x);
}

// "YYYY-MM-DD" for a local calendar day.
export const dayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromDayString = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m || 1) - 1, d || 1);
};
export const fmtDayString = (s: string) => fromDayString(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// ---------- hours (lib/hours.ts) ----------
export function shortHours(minutes: number) {
  if (minutes > 0 && minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}
export function hoursLabel(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? "" : "s"}`;
}
export const priceFor = (minutes: number, rateCents: number) => Math.round((minutes * rateCents) / 60);
export const mentorShare = (cents: number) => Math.round((cents * (100 - FEE_PERCENT)) / 100);

type Entry = { type: string; minutes: number; voidedAt?: string | null; callBookingId?: string | null };
type Call = { id: string; startTime: string; endTime: string; status: string; outcome?: string | null; kind?: string | null };
export type HoursLike = { minutesPurchased: number; hourEntries?: Entry[]; callBookings?: Call[] };

export function hoursSummary(o: HoursLike, now: Date = new Date()) {
  const entries = (o.hourEntries || []).filter((e) => !e.voidedAt);
  const usedCalls = entries.filter((e) => e.type === "CALL").reduce((s, e) => s + e.minutes, 0);
  const usedWritten = entries.filter((e) => e.type === "WRITTEN").reduce((s, e) => s + e.minutes, 0);
  const used = usedCalls + usedWritten;
  const logged = new Set(entries.map((e) => e.callBookingId).filter(Boolean) as string[]);
  const reserved = (o.callBookings || [])
    .filter((b) => b.status === "BOOKED" && (b.kind ?? "ORDER") === "ORDER" && !logged.has(b.id) && !FREES_THE_CALL.includes(b.outcome || ""))
    .reduce((s, b) => s + minutesBetween(b.startTime, b.endTime), 0);
  const purchased = Math.max(0, o.minutesPurchased || 0);
  const left = Math.max(0, purchased - used - reserved);
  const upcoming = (o.callBookings || []).filter((b) => b.status === "BOOKED" && new Date(b.endTime) > now).sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
  return { purchased, used, usedCalls, usedWritten, reserved, left, callsHeld: entries.filter((e) => e.type === "CALL").length, upcoming };
}

// ---------- finishing (lib/finishing.ts) ----------
export type FinishLike = { status: string; disputed?: boolean; markedCompleteAt?: string | null; responseDeadline?: string | null; lastCallUsedAt?: string | null; lastRevisionUsedAt?: string | null; approvedAt?: string | null };
export type Phase = "PAYING" | "WORKING" | "AWAITING_STUDENT" | "APPROVED" | "DISPUTED" | "CLOSED";

export function finishPhase(o: FinishLike): Phase {
  if (o.status === "PENDING_PAYMENT") return "PAYING";
  if (o.approvedAt || o.status === "COMPLETED" || o.status === "RELEASED") return "APPROVED";
  if (o.status !== "IN_ESCROW") return "CLOSED";
  if (o.disputed) return "DISPUTED";
  if (o.markedCompleteAt && o.responseDeadline) return "AWAITING_STUDENT";
  return "WORKING";
}

export function hoursToRespond(o: FinishLike) {
  if (finishPhase(o) !== "AWAITING_STUDENT" || !o.responseDeadline) return null;
  return Math.max(0, Math.ceil((new Date(o.responseDeadline).getTime() - Date.now()) / 3600_000));
}

export function markCompleteBlocker(o: FinishLike & { upcomingCalls?: number }) {
  const phase = finishPhase(o);
  if (phase === "AWAITING_STUDENT") return "You've already marked this complete. The student is reviewing it.";
  if (phase === "DISPUTED") return "This order has an open dispute. An admin will resolve it.";
  if (phase !== "WORKING") return "This package isn't active.";
  if ((o.upcomingCalls || 0) > 0) return "A call is still booked on this package. Mark it complete after the call (or cancel it).";
  return null;
}

type Tone = "plain" | "ok" | "warn" | "bad" | "gray";
export function packageStatus(o: FinishLike): { label: string; tone: Tone } {
  const phase = finishPhase(o);
  if (phase === "PAYING") return { label: "Awaiting payment", tone: "gray" };
  if (phase === "DISPUTED") return { label: "Disputed", tone: "bad" };
  if (phase === "APPROVED") return { label: "Completed", tone: "ok" };
  if (phase === "CLOSED") return { label: o.status === "REFUNDED" ? "Refunded" : "Cancelled", tone: "gray" };
  if (phase === "AWAITING_STUDENT") return { label: `Respond in ${hoursToRespond(o)} h`, tone: "warn" };
  if (o.lastCallUsedAt || o.lastRevisionUsedAt) return { label: o.lastCallUsedAt ? "Last call requested" : "Last revision requested", tone: "plain" };
  return { label: "Active", tone: "plain" };
}

// Running low: 1 hour or less left on an active package that started with more.
export const isLowOnHours = (o: HoursLike & FinishLike) => finishPhase(o) === "WORKING" && (o.minutesPurchased || 0) > 60 && hoursSummary(o).left <= 60;

// Orders from before hourly pricing (no kind): due dates and deliveries.
export function legacyStatus(o: { status: string; disputed?: boolean; revisionRequested?: boolean }): { label: string; tone: Tone } {
  if (o.disputed && o.status === "IN_ESCROW") return { label: "Disputed", tone: "bad" };
  if (o.status === "IN_ESCROW") return o.revisionRequested ? { label: "Revision requested", tone: "warn" } : { label: "In progress", tone: "plain" };
  if (o.status === "COMPLETED") return { label: "Waiting for approval", tone: "warn" };
  if (o.status === "RELEASED") return { label: "Completed", tone: "ok" };
  if (o.status === "REFUNDED") return { label: "Refunded", tone: "gray" };
  return { label: "Cancelled", tone: "gray" };
}

export const PackageChip = ({ order }: { order: any }) => {
  const s = order.kind ? packageStatus(order) : legacyStatus(order);
  return <Chip label={s.label} tone={s.tone} />;
};

// ---------- calls (lib/calls.ts) ----------
export function joinState(b: { startTime: string; endTime: string }, now: Date = new Date()): "early" | "open" | "ended" {
  const start = new Date(b.startTime).getTime();
  const end = new Date(b.endTime).getTime();
  if (now.getTime() < start - JOIN_OPENS_MINUTES_BEFORE * 60_000) return "early";
  if (now.getTime() > end + JOIN_CLOSES_MINUTES_AFTER * 60_000) return "ended";
  return "open";
}
export const canChangeOnline = (b: { startTime: string }) => new Date(b.startTime).getTime() - Date.now() > CANCEL_CUTOFF_HOURS * 3600_000;
export const isLateChange = (b: { startTime: string }) => !canChangeOnline(b) && new Date(b.startTime).getTime() > Date.now();

// ---------- payouts (lib/payoutRules.ts) ----------
export function payoutDayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, (m || 1) - 1, d || 1, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 24, 12)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export const PAYOUT_STATUS_LABEL: Record<string, string> = { PROCESSING: "Sending", PAID: "Paid", FAILED: "Failed", PENDING: "Pending", SKIPPED: "Skipped" };

// ---------- hooks ----------
// Reloads a screen's data when you come back to it (not on the first visit,
// which already loaded).
export function useReloadOnFocus(reload: () => void) {
  const first = useRef(true);
  const fn = useRef(reload);
  fn.current = reload;
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      fn.current();
    }, [])
  );
}

// Opens a page of mentorsmd.com in the in-app browser.
export const openSite = (path: string) => WebBrowser.openBrowserAsync(SITE + path);

// ---------- small pieces ----------
export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const c = useColors();
  return (
    <Card tone="danger">
      <Note style={{ color: c.danger }}>{error}</Note>
      {onRetry ? <Link label="Try again" onPress={onRetry} /> : null}
    </Card>
  );
}

export function ErrText({ children }: { children: ReactNode }) {
  const c = useColors();
  return children ? <Small style={{ color: c.danger }}>{children}</Small> : null;
}

// The website's message-safety warnings ("Please read this before sending").
export type Warning = { kind: string; text: string };
export const warningsOf = (e: unknown): Warning[] | null => (e instanceof ApiError && e.data?.code === "WARNING" ? (e.data.warnings as Warning[]) || [] : null);

export function WarningsCard({ warnings, busy, onEdit, onSendAnyway }: { warnings: Warning[]; busy?: boolean; onEdit: () => void; onSendAnyway: () => void }) {
  const c = useColors();
  return (
    <Card tone="warn">
      <TT style={{ color: c.warnFg }}>Please read this before sending</TT>
      {warnings.map((w) => <Note key={w.kind} style={{ color: c.warnFg }}>{w.text}</Note>)}
      <RowV>
        <Btn sm kind="line" label="Edit message" onPress={onEdit} />
        <Btn sm label={busy ? "Sending…" : "Send anyway"} disabled={busy} onPress={onSendAnyway} />
      </RowV>
    </Card>
  );
}

// A message box that keeps what you typed when sending fails.
export function MessageBox({ placeholder, value, onChange, onSend, disabled, busy }: { placeholder: string; value: string; onChange: (v: string) => void; onSend: () => void; disabled?: boolean; busy?: boolean }) {
  const c = useColors();
  const off = disabled || busy || !value.trim();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.faint} accessibilityLabel={placeholder} multiline editable={!disabled}
        style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.body, fontSize: 15, color: c.ink }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: off }} disabled={off} onPress={onSend}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, opacity: off ? 0.5 : 1, alignItems: "center", justifyContent: "center" }}>
        <Icon name="send" size={18} color={c.onPrimary} />
      </Pressable>
    </View>
  );
}

// Days to pick from, as chips that scroll sideways: `from` days from
// today (negative = past) to `to`.
export function DayChips({ value, onChange, from, to }: { value: string; onChange: (d: string) => void; from: number; to: number }) {
  const days: string[] = [];
  const t = new Date();
  for (let i = from; i <= to; i++) days.push(dayString(new Date(t.getFullYear(), t.getMonth(), t.getDate() + i)));
  if (from < 0) days.reverse();
  return (
    <FChipRow>
      {days.map((d) => <FChip key={d} label={dayWord(fromDayString(d))} on={d === value} onPress={() => onChange(d)} />)}
    </FChipRow>
  );
}

// A month calendar: tap a day (or a first and last day, with `range`).
export function DayGrid({ start, end, onChange, range, minDay }: { start: string | null; end?: string | null; onChange: (start: string | null, end: string | null) => void; range?: boolean; minDay?: string }) {
  const c = useColors();
  const init = start ? fromDayString(start) : new Date();
  const [month, setMonth] = useState(new Date(init.getFullYear(), init.getMonth(), 1));
  const days: (Date | null)[] = [];
  for (let i = 0; i < month.getDay(); i++) days.push(null);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (days.length % 7) days.push(null);
  const pick = (d: string) => {
    if (!range) return onChange(d, null);
    if (!start || end || d < start) return onChange(d, null);
    onChange(start, d);
  };
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  return (
    <View style={{ gap: 8 }}>
      <RowV style={{ justifyContent: "space-between" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shift(-1)} hitSlop={10}><Icon name="chevron-left" /></Pressable>
        <TT>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</TT>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shift(1)} hitSlop={10}><Icon name="chevron-right" /></Pressable>
      </RowV>
      <View style={{ flexDirection: "row" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((l, i) => <Text key={i} style={{ flex: 1, textAlign: "center", fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted }}>{l}</Text>)}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((d, i) => {
          if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 40 }} />;
          const s = dayString(d);
          const off = !!minDay && s < minDay;
          const on = s === start || s === end || (!!start && !!end && s > start && s < end);
          return (
            <Pressable key={i} disabled={off} accessibilityRole="button" accessibilityState={{ selected: on, disabled: off }} accessibilityLabel={d.toDateString()} onPress={() => pick(s)}
              style={{ width: `${100 / 7}%`, height: 40, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.primary : "transparent" }}>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: off ? c.line : on ? c.onPrimary : c.ink }}>{d.getDate()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// "Are you sure?" as a bottom sheet.
export function useConfirm() {
  const { openSheet, closeSheet } = useOverlay();
  return (o: { title: string; body: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; onConfirm: () => Promise<void> | void }) =>
    openSheet(() => <ConfirmSheet {...o} close={closeSheet} />);
}
function ConfirmSheet({ title, body, confirmLabel, cancelLabel, danger, onConfirm, close }: { title: string; body: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; onConfirm: () => Promise<void> | void; close: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <H>{title}</H>
      <Note>{body}</Note>
      <ErrText>{error}</ErrText>
      <Btn kind={danger ? "red" : "dark"} label={busy ? "One moment…" : confirmLabel} disabled={busy} onPress={go} />
      <Btn kind="line" label={cancelLabel || "Cancel"} onPress={close} />
    </>
  );
}

// ---------- moving and cancelling a call ----------
// A call from /api/me/calendar or an order's callBookings.
export type CallRowData = { id: string; startTime: string; endTime: string; kind?: string; orderId?: string | null; disputed?: boolean; withName?: string };

// Move: open times from /api/orders/[id]/slots?exclude=<call>, then PATCH
// /api/orders/[id]/calls. Inside 24 hours a reason is needed (sent to the
// student as a message). Cancel: DELETE /api/orders/[id]/calls, or
// /api/intro-calls/[id] for a free intro call.
export function CallSheet({ call, onChanged }: { call: CallRowData; onChanged: () => void }) {
  const c = useColors();
  const { closeSheet, toast } = useOverlay();
  const [mode, setMode] = useState<"menu" | "move">("menu");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Warning[] | null>(null);
  const intro = call.kind === "INTRO" || !call.orderId;
  const late = isLateChange(call);
  const changeable = canChangeOnline(call);
  const who = firstName(call.withName) || "the student";
  const started = new Date(call.startTime).getTime() <= Date.now();

  const loadSlots = useCallback(async () => {
    setSlotsError(null);
    setSlots(null);
    try {
      const d = await api<{ slots: string[] }>(`/api/orders/${encodeURIComponent(call.orderId || "")}/slots?exclude=${encodeURIComponent(call.id)}`);
      setSlots(d.slots || []);
      if (d.slots?.length) setDay(dayString(new Date(d.slots[0]!)));
    } catch (e) {
      setSlotsError(errorText(e));
    }
  }, [call.id, call.orderId]);
  useEffect(() => {
    if (mode === "move") loadSlots();
  }, [mode, loadSlots]);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      if (intro) await api(`/api/intro-calls/${encodeURIComponent(call.id)}`, { method: "DELETE" });
      else await api(`/api/orders/${encodeURIComponent(call.orderId!)}/calls`, { method: "DELETE", body: { bookingId: call.id } });
      closeSheet();
      toast("Call cancelled. You both got an email.");
      onChanged();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const move = async (ack = false) => {
    if (!picked) return setError("Pick a new time.");
    if (late && reason.trim().length < LATE_REASON_MIN) return setError(`Please explain why you need to move the call (at least ${LATE_REASON_MIN} characters).`);
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${encodeURIComponent(call.orderId!)}/calls`, { method: "PATCH", body: { bookingId: call.id, startTime: picked, ...(late ? { reason: reason.trim(), acknowledgeWarnings: ack } : {}) } });
      closeSheet();
      toast(`Call moved to ${fmtWhen(picked)}. You both got an email.`);
      onChanged();
    } catch (e) {
      const w = warningsOf(e);
      if (w) setWarnings(w);
      else setError(errorText(e));
      setBusy(false);
    }
  };

  if (mode === "move") {
    const days = Array.from(new Set((slots || []).map((s) => dayString(new Date(s)))));
    const times = (slots || []).filter((s) => dayString(new Date(s)) === day);
    return (
      <>
        <H>Reschedule the Call</H>
        <Note>Now: {fmtWhen(call.startTime)}. Pick a new time; you’ll both get an email with the updated calendar invite.</Note>
        {late ? <Card tone="warn"><Note style={{ color: c.warnFg }}>Less than {CANCEL_CUTOFF_HOURS} hours to go: moving it needs a short reason that’s sent to {who}.</Note></Card> : null}
        {slotsError ? <ErrorBox error={slotsError} onRetry={loadSlots} /> : !slots ? <Small>Loading open times…</Small> : !slots.length ? (
          <Note>No open times in your call hours right now. Change your call hours on mentorsmd.com, or agree a time with {who} in messages.</Note>
        ) : (
          <>
            <FChipRow>{days.map((d) => <FChip key={d} label={dayWord(fromDayString(d))} on={d === day} onPress={() => { setDay(d); setPicked(null); }} />)}</FChipRow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {times.map((t) => <FChip key={t} label={fmtTime(t)} on={t === picked} onPress={() => setPicked(t)} />)}
            </View>
          </>
        )}
        {late ? (
          <View style={{ gap: 6 }}>
            <Small>Why do you need to move it? (sent to {who})</Small>
            <TextInput value={reason} onChangeText={setReason} multiline placeholder="At least 20 characters" placeholderTextColor={c.faint}
              style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 12, padding: 12, minHeight: 80, fontFamily: fonts.body, fontSize: 15, color: c.ink, textAlignVertical: "top" }} />
          </View>
        ) : null}
        {warnings ? <WarningsCard warnings={warnings} busy={busy} onEdit={() => setWarnings(null)} onSendAnyway={() => move(true)} /> : null}
        <ErrText>{error}</ErrText>
        <Btn kind="dark" label={busy ? "Moving…" : picked ? `Move to ${fmtWhen(picked)}` : "Move the call"} disabled={busy || !picked} onPress={() => move(false)} />
        <Btn kind="line" label="Back" onPress={() => setMode("menu")} />
      </>
    );
  }

  return (
    <>
      <H>{call.withName ? `Call With ${call.withName}` : "Call"}</H>
      <Note>{fmtWhen(call.startTime)} to {fmtTime(call.endTime)} · {minutesBetween(call.startTime, call.endTime)} min</Note>
      {call.disputed ? (
        <Note>Calls can’t be moved while a dispute is open.</Note>
      ) : started ? (
        <Note>This call has already started.</Note>
      ) : (
        <>
          {!intro && (changeable || late) ? <Btn kind="dark" label="Reschedule" onPress={() => setMode("move")} /> : null}
          {changeable ? (
            <Btn kind="line" label={busy ? "Cancelling…" : "Cancel the call"} disabled={busy} onPress={cancel} />
          ) : (
            <Note>Less than {CANCEL_CUTOFF_HOURS} hours to go: the call can’t be cancelled on the site{intro ? "" : ", and moving it needs a short reason that’s sent to " + who}. Contact us if something comes up.</Note>
          )}
          {intro ? <Small>Free intro calls can be cancelled until {CANCEL_CUTOFF_HOURS} hours before. The student can then book a new one.</Small> : null}
        </>
      )}
      <ErrText>{error}</ErrText>
      <Link label="Close" onPress={closeSheet} style={{ alignSelf: "center" }} />
    </>
  );
}
