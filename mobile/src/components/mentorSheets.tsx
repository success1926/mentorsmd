import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api, ApiError, errorText, SITE } from "../lib/api";
import { dayString, dayWord, firstName, fmtDateTime, fmtDay, fmtMonth, fmtMonthDay, fmtTime, fromDayString, minutesBetween } from "../lib/format";
import { CANCEL_CUTOFF_HOURS, canChangeOnline, isLateChange, LATE_REASON_MIN } from "../lib/orders";
import { useOverlay } from "../lib/overlay";
import { fonts, useColors } from "../lib/theme";
import { Btn, Card, FChip, FChipRow, H, Icon, Link, Note, RowV, Small, TT } from "./ui";

// The mentor side of the app, against the real website (mentorsmd.com):
// mentor-only settings and wording, and the small pieces several mentor
// screens share. Hours, finishing and call rules live in lib/orders.ts,
// status words in lib/statusLabels.ts, the fee in lib/fee.ts and dates in
// lib/format.ts (one copy each, shared with the student screens).

export const BUNDLE_HOURS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
export const RATE_RULE = "Rates are whole dollars, at least $50 an hour (up to $2,000)";
export const BOOKING_WINDOW_OPTIONS = [7, 14, 30, 60, 90];

// ---------- payouts (lib/payoutRules.ts) ----------
// "Dec 24" for a payout day ("YYYY-MM-DD", a date-only value).
export function payoutDayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return fmtMonthDay(new Date(Date.UTC(y!, (m || 1) - 1, d || 1, 12)), { timeZone: "UTC" });
}
// "Nov 24, 2026" for a payout period ("YYYY-MM"): the 24th of that month.
export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return fmtDay(new Date(Date.UTC(y, m - 1, 24, 12)), { timeZone: "UTC" });
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
        <TT>{fmtMonth(month)}</TT>
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
      toast(`Call moved to ${fmtDateTime(picked)}. You both got an email.`);
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
        <Note>Now: {fmtDateTime(call.startTime)}. Pick a new time; you’ll both get an email with the updated calendar invite.</Note>
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
        <Btn kind="dark" label={busy ? "Moving…" : picked ? `Move to ${fmtDateTime(picked)}` : "Move the call"} disabled={busy || !picked} onPress={() => move(false)} />
        <Btn kind="line" label="Back" onPress={() => setMode("menu")} />
      </>
    );
  }

  return (
    <>
      <H>{call.withName ? `Call With ${call.withName}` : "Call"}</H>
      <Note>{fmtDateTime(call.startTime)} to {fmtTime(call.endTime)} · {minutesBetween(call.startTime, call.endTime)} min</Note>
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
