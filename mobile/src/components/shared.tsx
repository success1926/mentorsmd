import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { initPaymentSheet, initStripe, presentPaymentSheet } from "@stripe/stripe-react-native";
import { useOverlay } from "../lib/demo";
import { money, type Mentor } from "../lib/sample";
import { fonts, useColors } from "../lib/theme";
import { Loading } from "./ui";
import { Av, Bar, Btn, Card, Chip, Chips, DateBox, Eyebrow, Field, Grow, H, Hdr, Link, Note, Price, Row, RowV, SchoolLogo, Sec, Small, SS, Stars, TT } from "./ui";
import { useCallback, useRef, useState } from "react";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { api, dollars, errorText, SITE, useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/sample";
import { callMinutes, canChangeOnline, dayNum, dow, fmtTime, fmtWhen, hoursSummary, JOIN_OPENS_MINUTES_BEFORE, joinState, packageStatus, pkgTitle, shortHours, splitCredit, type Pkg } from "../lib/orders";

// A mentor in a list: photo, rank, school, specialties, "Successful clients at" logos, price and rating.
export function MentorCard({ m }: { m: Mentor }) {
  const c = useColors();
  const router = useRouter();
  return (
    <Card onPress={() => router.push(`/profile/${m.id}`)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 }}>
      <Av init={m.init} photo={m.photo} />
      <Grow gap={4}>
        <TT>{m.name}</TT>
        {m.stage ? <SS style={{ color: c.ink, fontFamily: fonts.bodySemi }}>{m.stage}</SS> : null}
        {m.school ? <RowV gap={8}><SchoolLogo name={m.school} size={20} /><SS style={{ flexShrink: 1 }}>{m.school}</SS></RowV> : null}
        {m.specialties.length ? <View style={{ marginTop: 4 }}><Chips>{m.specialties.slice(0, 2).map((s) => <Chip key={s} label={s} />)}</Chips></View> : null}
        {m.clients.length ? (
          <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 8, marginTop: 6, gap: 5 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11, color: c.muted }}>Successful clients at:</Text>
            <RowV gap={5} style={{ flexWrap: "wrap" }}>{m.clients.slice(0, 5).map((s) => <SchoolLogo key={s} name={s} />)}</RowV>
          </View>
        ) : null}
      </Grow>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Small>From</Small>
        <Price>{money(m.rate)}/hr</Price>
        {m.rating != null && m.reviews ? <Stars>★ {m.rating.toFixed(1)}</Stars> : <Small>New</Small>}
        {m.reviews ? <Small>{m.reviews} reviews</Small> : null}
      </View>
    </Card>
  );
}

// One of the student's packages (from /api/packages), with hours left.
export function PkgCard({ p }: { p: Pkg }) {
  const router = useRouter();
  const h = hoursSummary(p);
  const st = packageStatus(p);
  return (
    <Card onPress={() => router.push(`/student/package/${p.id}`)}>
      <RowV>
        <Av init={initials(p.seller?.name || "")} photo={p.seller?.photoUrl} size={36} />
        <Grow><TT numberOfLines={2}>{pkgTitle(p)}</TT><SS>{p.seller?.name}</SS></Grow>
        <Chip label={st.label} tone={st.tone} />
      </RowV>
      <Bar pct={h.purchased ? ((h.purchased - h.left) / h.purchased) * 100 : 0} />
      <SS>
        {shortHours(h.left)} left of {shortHours(h.purchased)} · {h.callsHeld} {h.callsHeld === 1 ? "call" : "calls"} held
        {p.newMessages ? ` · ${p.newMessages} new message${p.newMessages === 1 ? "" : "s"}` : ""}
      </SS>
    </Card>
  );
}

// ---------- paying ----------
// What can be bought in the app (/api/app/checkout on the website).
export type CheckoutWhat =
  | { type: "offer"; gigId: string }
  | { type: "call"; mentorId: string; start: string; minutes: 30 | 60 }
  | { type: "hours"; orderId: string; hours: number };
type CheckoutStart = {
  paid: boolean; orderId: string; topUpId?: string;
  clientSecret?: string; paymentIntentId?: string; chargeCents?: number; creditCents?: number; publishableKey?: string | null;
};
export type CheckoutResult = { status: "paid" | "pending" | "cancelled"; orderId: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pays through Stripe's payment sheet (card, Apple Pay, Google Pay), after
// MentorsMD credit. Credit that covers everything needs no sheet. Closing
// the sheet cancels the payment and gives any credit back.
export async function runCheckout(what: CheckoutWhat): Promise<CheckoutResult> {
  const r = await api<CheckoutStart>("/api/app/checkout", { body: what });
  if (r.paid) return { status: "paid", orderId: r.orderId };
  const target = r.topUpId ? { topUpId: r.topUpId } : { orderId: r.orderId };
  const cancel = async () => {
    try {
      return (await api<{ status: string }>("/api/app/checkout/cancel", { body: target })).status;
    } catch {
      return "cancelled";
    }
  };
  if (!r.clientSecret || !r.publishableKey) {
    await cancel();
    throw new Error("Card payments aren't available right now. Please try again later.");
  }
  await initStripe({ publishableKey: r.publishableKey, merchantIdentifier: "merchant.com.mentorsmd.app", urlScheme: "mentorsmd" });
  const init = await initPaymentSheet({
    paymentIntentClientSecret: r.clientSecret,
    merchantDisplayName: "MentorsMD",
    applePay: { merchantCountryCode: "US" },
    googlePay: { merchantCountryCode: "US", currencyCode: "USD", testEnv: r.publishableKey.startsWith("pk_test") },
    returnURL: "mentorsmd://stripe-redirect",
    style: "automatic",
  });
  if (init.error) {
    await cancel();
    throw new Error(init.error.message || "Couldn't open the payment. Please try again.");
  }
  const res = await presentPaymentSheet();
  if (res.error) {
    // Closed without paying (or it failed): cancel it, unless it went through after all.
    const s = await cancel();
    if (s === "paid") return { status: "paid", orderId: r.orderId };
    if (String(res.error.code) === "Canceled") return { status: "cancelled", orderId: r.orderId };
    throw new Error(res.error.message || "The payment didn't go through. Nothing was charged.");
  }
  const done = await api<{ status: string }>("/api/app/checkout/confirm", { body: target }).catch(() => ({ status: "pending" }));
  return { status: done.status === "paid" ? "paid" : "pending", orderId: r.orderId };
}

export type PayItem = {
  what: CheckoutWhat;
  title: string; // what's being bought, e.g. "3 hours with Jordan"
  mentorName: string;
  priceCents: number;
  // After paying (or "still confirming"). Defaults to opening the package.
  onPaid?: (r: CheckoutResult) => void;
};

// Paying for an offer, a single call or more hours: what it costs, the
// MentorsMD credit applied first, then Stripe's payment sheet.
export function usePaySheet() {
  const { openSheet } = useOverlay();
  return (item: PayItem) => openSheet(() => <PaySheet item={item} />);
}
function PaySheet({ item }: { item: PayItem }) {
  const c = useColors();
  const { closeSheet, toast } = useOverlay();
  const router = useRouter();
  const credit = useApi<{ balanceCents: number }>("/api/me/credit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balance = credit.data?.balanceCents || 0;
  const split = splitCredit(item.priceCents, balance);
  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      // Stripe's sheet can't open over this one.
      closeSheet();
      if (split.chargeCents > 0) await wait(450);
      const r = await runCheckout(item.what);
      if (r.status === "cancelled") return toast("Payment cancelled. Nothing was charged.");
      toast(r.status === "paid" ? (split.chargeCents ? "Payment received." : "Paid with your MentorsMD credit.") : "Confirming your payment with Stripe… it shows up in a few seconds.");
      if (item.onPaid) item.onPaid(r);
      else router.push(`/student/package/${r.orderId}`);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <RowV style={{ justifyContent: "space-between" }}><H>Pay MentorsMD</H><Small>Secured by Stripe</Small></RowV>
      <Card>
        <RowV style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}><Note ink>{item.title}</Note><Small>with {item.mentorName}</Small></View>
          <Price>{dollars(item.priceCents)}</Price>
        </RowV>
        {credit.loading && !credit.data ? <Small>Checking your MentorsMD credit…</Small> : null}
        {split.creditCents ? <RowV style={{ justifyContent: "space-between" }}><SS>MentorsMD credit</SS><TT>−{dollars(split.creditCents)}</TT></RowV> : null}
        <RowV style={{ justifyContent: "space-between", borderTopWidth: 1, borderColor: c.line, paddingTop: 10 }}>
          <TT style={{ fontSize: 16 }}>{split.chargeCents ? "You pay" : "Nothing to pay by card"}</TT>
          <Price style={{ fontSize: 16 }}>{dollars(split.chargeCents)}</Price>
        </RowV>
      </Card>
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      <Btn kind="dark" label={busy ? "Opening…" : split.chargeCents ? `Pay ${dollars(split.chargeCents)}` : "Pay with credit"} disabled={busy || (credit.loading && !credit.data)} onPress={pay} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
      <Small>You pay MentorsMD, not the mentor. MentorsMD credit is used first. Unused hours aren’t refunded if you finish early; every hour used is logged on your package page.</Small>
    </>
  );
}

// ---------- picking a time ----------
const dayKey = (iso: string) => new Date(iso).toDateString();
// Open times grouped by day (in the phone's time zone): day chips, then times.
export function SlotPicker({ slots, value, onChange }: { slots: string[]; value: string | null; onChange: (iso: string) => void }) {
  const c = useColors();
  const days = Array.from(new Set(slots.map(dayKey)));
  const [day, setDay] = useState(days[0] || "");
  const cur = days.includes(day) ? day : days[0];
  const times = slots.filter((s) => dayKey(s) === cur);
  const pick = (on: boolean) => ({ borderWidth: 1, borderColor: on ? c.primary : c.line, backgroundColor: on ? c.primary : c.surface });
  if (!slots.length) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {days.map((d) => {
          const dt = new Date(d);
          const on = d === cur;
          return (
            <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} onPress={() => setDay(d)}
              style={[{ width: 56, borderRadius: 12, paddingVertical: 8, alignItems: "center" }, pick(on)]}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: on ? c.onPrimary : c.muted }}>{dt.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: on ? c.onPrimary : c.ink }}>{dt.getDate()}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: on ? c.onPrimary : c.muted }}>{dt.toLocaleDateString("en-US", { month: "short" })}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {times.map((t) => {
          const on = value === t;
          return (
            <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(t)}
              style={[{ width: "31.5%", borderRadius: 10, paddingVertical: 10, alignItems: "center" }, pick(on)]}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? c.onPrimary : c.ink }}>{new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

// ---------- moving or cancelling a call ----------
// A call from /api/me/calendar (or a package's calls).
export type MoveCall = { id: string; startTime: string; endTime: string; orderId: string | null; kind?: string | null; withName?: string };

// Move or cancel a booked call, for the student or the mentor. Package calls
// move to another open time (inside 24 hours a reason is needed, and it's
// sent as a message); free intro calls can only be cancelled.
export function MoveSheet({ call, onChanged }: { call?: MoveCall; onChanged?: () => void } = {}) {
  const c = useColors();
  const { closeSheet, toast } = useOverlay();
  const intro = call?.kind === "INTRO" || !call?.orderId;
  const slots = useApi<{ slots: string[] }>(call && !intro ? `/api/orders/${call.orderId}/slots?exclude=${encodeURIComponent(call.id)}` : null);
  const [pick, setPick] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!call) {
    return (
      <>
        <H>Move This Call</H>
        <Note>Open a call from your calendar to move or cancel it.</Note>
        <Btn kind="line" label="Close" onPress={closeSheet} />
      </>
    );
  }
  const early = canChangeOnline(call);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      closeSheet();
      onChanged?.();
      toast(done);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const move = () => {
    if (!pick) return setError("Pick a new time.");
    if (!early && reason.trim().length < 20) return setError("Please say why you need to move it (at least 20 characters).");
    run(() => api(`/api/orders/${call.orderId}/calls`, { method: "PATCH", body: { bookingId: call.id, startTime: pick, reason: early ? undefined : reason.trim() } }), `Call moved to ${fmtWhen(pick)}. You both got an email.`);
  };
  const cancel = () =>
    run(
      () => (intro ? api(`/api/intro-calls/${encodeURIComponent(call.id)}`, { method: "DELETE" }) : api(`/api/orders/${call.orderId}/calls`, { method: "DELETE", body: { bookingId: call.id } })),
      intro ? "Intro call cancelled. You can book a new time." : "Call cancelled. Its hours are back on the package."
    );
  return (
    <>
      <H>{intro ? "Your Intro Call" : "Move This Call"}</H>
      <Note>{fmtWhen(call.startTime)}{call.withName ? ` · with ${call.withName}` : ""}</Note>
      {intro ? (
        early ? <Note>Intro calls can’t be moved. Cancel it and book a new time instead.</Note> : <Note>It’s less than 24 hours away, so it can’t be cancelled in the app. Message the other person, or contact us.</Note>
      ) : (
        <>
          <Note>{early ? "It’s more than 24 hours away, so no reason is needed." : "It’s less than 24 hours away: say why you need to move it. Your reason is sent as a message."}</Note>
          {slots.loading && !slots.data ? <Loading label="Loading open times" /> : slots.error ? (
            <Card tone="warn"><Note>{slots.error}</Note><Btn kind="line" sm label="Try again" onPress={slots.reload} /></Card>
          ) : slots.data && !slots.data.slots.length ? <Note>No open times right now. Message the other person to find one.</Note> : slots.data ? (
            <SlotPicker slots={slots.data.slots} value={pick} onChange={setPick} />
          ) : null}
          {!early ? <Field label="Why do you need to move it?" value={reason} onChange={setReason} multiline /> : null}
          <Btn kind="dark" label={busy ? "Saving…" : pick ? `Move to ${fmtWhen(pick)}` : "Pick a new time"} disabled={busy || !pick} onPress={move} />
        </>
      )}
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      {early ? <Link red label={intro ? "Cancel the intro call" : "Cancel the call"} onPress={busy ? undefined : cancel} /> : !intro ? <Small>Calls can’t be cancelled in the app within 24 hours of the start.</Small> : null}
      <Btn kind="line" label="Close" onPress={closeSheet} />
    </>
  );
}

export function GuideSheet() {
  const { closeSheet } = useOverlay();
  return (
    <>
      <H>Offer Guide</H>
      <Sec><Eyebrow>When a bundle fits</Eyebrow><Note>Ongoing help across several tasks: a student who wants you for secondaries and interview prep.</Note></Sec>
      <Sec><Eyebrow>When hourly fits</Eyebrow><Note>One-off questions, a quick essay read, a single mock interview.</Note></Sec>
      <Sec><Eyebrow>Example packages</Eyebrow><Note>“Personal Statement, Start to Finish” · about 5 hours · 2 calls + 3 rounds of edits</Note><Note>“MMI Mock Day” · 3 stations + written feedback · 2 hours</Note></Sec>
      <Sec><Eyebrow>Freelancing notes</Eyebrow><Note>You’re an independent mentor. Payouts come from MentorsMD through Stripe; keep records for taxes.</Note></Sec>
      <Btn kind="line" label="Close" onPress={closeSheet} />
    </>
  );
}

function DeleteSheet() {
  const c = useColors();
  const { closeSheet, toast } = useOverlay();
  const { forget } = useAuth();
  const router = useRouter();
  const check = useApi<{ allowed: boolean; blockers: string[]; creditCents: number; hasPassword: boolean }>("/api/me/delete-account");
  const [v, setV] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = check.data;
  const go = async () => {
    if (v.trim().toUpperCase() !== "DELETE") return setError("Type DELETE to confirm.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/delete-account", { body: { confirm: "DELETE", password: d?.hasPassword ? pw : undefined } });
      closeSheet();
      await forget();
      router.replace("/");
      toast("Your account was deleted");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <H style={{ color: c.danger }}>Delete My Account</H>
      {check.loading && !d ? <Loading /> : check.error ? <Note>{check.error}</Note> : d && !d.allowed ? (
        <>
          <Card tone="warn">{d.blockers.map((b) => <Note key={b} style={{ color: c.warnFg }}>{b}</Note>)}</Card>
          <Btn kind="line" label="OK" onPress={closeSheet} />
        </>
      ) : d ? (
        <>
          <Note>This happens right away and can’t be undone.</Note>
          <Card tone="warn"><Note style={{ color: c.warnFg }}>{d.creditCents ? `Your ${dollars(d.creditCents)} MentorsMD credit will be lost. ` : ""}Messages you sent will show as “Deleted user”. Receipts are kept for tax records.</Note></Card>
          {d.hasPassword ? <Field label="Your password" value={pw} onChange={setPw} secure /> : null}
          <Field label="Type DELETE to confirm" value={v} onChange={setV} placeholder="DELETE" />
          {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
          <Btn kind="red" label={busy ? "Deleting…" : "Delete my account"} disabled={busy} onPress={go} />
          <Btn kind="line" label="Keep my account" onPress={closeSheet} />
        </>
      ) : null}
    </>
  );
}

type AppSessionRow = { id: string; platform: string; deviceName: string | null; lastUsedAt: string; current: boolean };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Settings for students and mentors: who's signed in, phones signed in,
// password and 2-step (on the website), sign out, delete the account.
export function SettingsBody({ role }: { role: "student" | "mentor" }) {
  const { user, signOut } = useAuth();
  const { toast, openSheet } = useOverlay();
  const router = useRouter();
  const phones = useApi<{ sessions: AppSessionRow[] }>("/api/app/sessions");
  const endPhone = async (id: string) => {
    try {
      await api("/api/app/sessions", { body: { action: "sign-out", id } });
      phones.reload();
      toast("That phone is signed out");
    } catch (e) {
      toast(errorText(e));
    }
  };
  const settingsUrl = SITE + (role === "mentor" ? "/dashboard/settings" : "/account");
  const out = async () => {
    await signOut();
    router.replace("/");
    toast("Signed out");
  };
  const name = user?.name || "";
  const rows = phones.data?.sessions || [];
  return (
    <>
      <Card row><Av init={initials(name)} /><Grow><TT>{name}</TT><SS>{user?.email}</SS></Grow></Card>
      <Sec>
        <Eyebrow>Sign-in and security</Eyebrow>
        <View>
          <Row tt="Change password" ss="Opens mentorsmd.com" onPress={() => WebBrowser.openBrowserAsync(settingsUrl)} />
          <Row tt="2-step sign-in" ss="Set it up or change it on mentorsmd.com" onPress={() => WebBrowser.openBrowserAsync(settingsUrl)} last />
        </View>
      </Sec>
      <Sec>
        <Eyebrow>Phones signed in</Eyebrow>
        {phones.loading && !phones.data ? <Loading /> : (
          <View>
            {rows.map((d, i) => (
              <Row key={d.id} tt={d.deviceName || (d.platform === "ANDROID" ? "Android phone" : "iPhone")} ss={d.current ? "This phone" : `Last used ${shortDate(d.lastUsedAt)}`} chevron={false} last={i === rows.length - 1}
                rr={!d.current ? <Link red label="Sign out" onPress={() => endPhone(d.id)} /> : undefined} />
            ))}
          </View>
        )}
      </Sec>
      <Btn kind="line" label="Sign out" onPress={out} />
      <Link red style={{ alignSelf: "center" }} label="Delete my account" onPress={() => openSheet(() => <DeleteSheet />)} />
      <RowV style={{ justifyContent: "center", gap: 16 }}>
        <Link label="Terms" onPress={() => WebBrowser.openBrowserAsync(SITE + "/terms")} />
        <Link label="Privacy" onPress={() => WebBrowser.openBrowserAsync(SITE + "/privacy")} />
        <Link label="Help" onPress={() => WebBrowser.openBrowserAsync(SITE + "/contact")} />
      </RowV>
      <Small style={{ textAlign: "center" }}>MentorsMD app {Constants.expoConfig?.version || ""} · {role === "mentor" ? "Mentor" : "Student"} account</Small>
    </>
  );
}

export function SettingsScreenBody({ role }: { role: "student" | "mentor" }) {
  return (
    <>
      <Hdr title="Settings" />
      <SettingsBody role={role} />
    </>
  );
}

// A screen's "couldn't load" card with Try again.
export function LoadError({ error, onRetry, title = "Couldn’t load this" }: { error: string; onRetry: () => void; title?: string }) {
  return (
    <Card tone="warn">
      <TT>{title}</TT>
      <Note>{error}</Note>
      <Btn kind="line" sm label="Try again" onPress={onRetry} />
    </Card>
  );
}

// Reloads a screen's data each time it comes back into view, and every
// `everyMs` while it's on screen (e.g. the unread count, an open chat).
export function useRefresh(reload: () => void, everyMs?: number) {
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
      if (!everyMs) return;
      const t = setInterval(reload, everyMs);
      return () => clearInterval(t);
    }, [reload, everyMs])
  );
}

// A call from /api/me/calendar.
export type CalCall = MoveCall & { title: string; withName: string; withId: string; withRole: string; withPhotoUrl?: string | null; disputed?: boolean };

// An upcoming call: the date, who and what, and Join once the room is open
// (10 minutes before the start until 30 minutes after the end).
export function CallCard({ call, onMove }: { call: CalCall; onMove?: () => void }) {
  const router = useRouter();
  const open = joinState(call) === "open";
  const mins = callMinutes(call);
  const intro = call.kind === "INTRO";
  return (
    <Card row>
      <DateBox dow={dow(call.startTime)} day={dayNum(call.startTime)} />
      <Grow>
        <TT numberOfLines={2}>{call.withName} · {intro ? "Free intro call" : call.title}</TT>
        <SS>{fmtTime(call.startTime)} · {mins} min{open ? "" : ` · Join opens ${JOIN_OPENS_MINUTES_BEFORE} min before`}</SS>
      </Grow>
      {open ? <Btn kind="dark" sm label="Join" onPress={() => router.push(`/call/${call.id}`)} /> : onMove ? <Link label={intro ? "Change" : "Move"} onPress={onMove} /> : null}
    </Card>
  );
}

// One stable function that runs several reloads (for useRefresh).
export function useCallbackAll(...fns: (() => void)[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(() => fns.forEach((f) => f()), fns);
}
