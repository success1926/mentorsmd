import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { LoadError, SlotPicker, usePaySheet } from "../../components/shared";
import { Btn, Card, Hdr, Loading, Note, Row, Screen, Seg, Small, TT } from "../../components/ui";
import { api, dollars, errorText, useApi } from "../../lib/api";
import { useOverlay } from "../../lib/demo";
import { first, fmtWhen, localZone, shortHours } from "../../lib/orders";
import { useColors } from "../../lib/theme";

type Slots = { slots: string[]; hasAvailability: boolean; bookingWindowDays?: number; timeZone: string; packages?: { id: string; title: string; left: number }[]; payPerCall?: { available: boolean; price30: number; price60: number } | null };

// Book a call with a mentor:
//   kind=intro  the free 15-minute intro call (/api/mentors/[id]/intro-slots, /api/intro-calls)
//   o=<order>   30 or 60 minutes from that package's hours (/api/orders/[id]/slots and /calls)
//   kind=call   from any package with this mentor that has hours left, or
//               paid for on its own (/api/mentors/[id]/call-slots, /book-call, app checkout)
export default function Book() {
  const p = useLocalSearchParams<{ m: string; kind?: string; o?: string; name?: string; left?: string }>();
  const c = useColors();
  const router = useRouter();
  const { toast } = useOverlay();
  const pay = usePaySheet();
  const intro = p.kind === "intro";
  const orderId = p.o || "";
  const left = p.left ? Number(p.left) : undefined;
  const [minutes, setMinutes] = useState<30 | 60>(left !== undefined && left < 60 ? 30 : 60);
  const [slot, setSlot] = useState<string | null>(null);
  const [pkg, setPkg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mentorName = p.name || "your mentor";
  const mf = first(p.name) || "your mentor";
  const url = intro
    ? `/api/mentors/${encodeURIComponent(p.m)}/intro-slots`
    : orderId
      ? `/api/orders/${encodeURIComponent(orderId)}/slots?minutes=${minutes}`
      : `/api/mentors/${encodeURIComponent(p.m)}/call-slots?minutes=${minutes}`;
  const q = useApi<Slots>(url);
  const d = q.data;
  const fitting = (d?.packages || []).filter((x) => x.left >= minutes);
  const chosen = orderId || (fitting.find((x) => x.id === pkg) || fitting[0])?.id || "";
  const payPerCall = !intro && !orderId && !chosen;
  const ppc = d?.payPerCall;
  const price = ppc ? (minutes === 60 ? ppc.price60 : ppc.price30) : 0;
  const tooShort = !!orderId && left !== undefined && left < minutes;

  const booked = (when: string) => {
    router.back();
    toast(`${intro ? "Free intro call booked" : "Call booked"}: ${fmtWhen(when)}. You both got a calendar invite.`);
  };
  const book = async () => {
    if (!slot) return;
    setError(null);
    if (payPerCall) {
      if (!ppc?.available) return setError(`Buying unlocks once ${mf} replies to your message, or after your free intro call.`);
      return pay({
        what: { type: "call", mentorId: p.m, start: slot, minutes },
        title: `${minutes === 60 ? "1-hour call" : "30-minute call"} · ${fmtWhen(slot)}`,
        mentorName,
        priceCents: price,
        onPaid: (r) => router.replace(`/student/package/${r.orderId}`),
      });
    }
    setBusy(true);
    try {
      if (intro) await api("/api/intro-calls", { body: { mentorId: p.m, startTime: slot } });
      else if (orderId) await api(`/api/orders/${encodeURIComponent(orderId)}/calls`, { body: { startTime: slot, minutes } });
      else await api(`/api/mentors/${encodeURIComponent(p.m)}/book-call`, { body: { startTime: slot, minutes, orderId: chosen } });
      booked(slot);
    } catch (e) {
      setError(errorText(e));
      q.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Hdr title={intro ? "Free Intro Call" : "Book a Call"} sub={p.name || undefined} />
      <Note>
        {intro
          ? `15 minutes on video with ${mf} to see if you’re a good fit. Free, one intro call per mentor.`
          : orderId
            ? `${minutes === 60 ? "1 hour" : "30 minutes"} on ${mf}’s calendar, taken from your package hours. No payment needed.${left !== undefined ? ` You have ${shortHours(left)} left.` : ""}`
            : `30 or 60 minutes on ${mf}’s calendar.`}
      </Note>
      {!intro ? <Seg options={[[30, "30 minutes"], [60, "60 minutes"]]} value={minutes} onChange={(v) => { setMinutes(v); setSlot(null); }} /> : null}
      {tooShort ? <Card tone="warn"><Note>Not enough hours left for a {minutes}-minute call. Pick 30 minutes, or add hours on the package page.</Note></Card> : null}

      {!intro && !orderId && d ? (
        fitting.length ? (
          <View>
            <Small>Uses hours from:</Small>
            {fitting.map((x, i) => <Row key={x.id} tt={x.title} ss={`${shortHours(x.left)} left`} chevron={false} last={i === fitting.length - 1} rr={chosen === x.id ? <TT style={{ color: c.primary }}>✓</TT> : undefined} onPress={() => setPkg(x.id)} />)}
          </View>
        ) : ppc ? (
          <Card tone="tint"><Note ink>No hours left with {mf}. Pay for this call on its own: {dollars(price)} at {dollars(ppc.price60)}/hr.</Note>{!ppc.available ? <Small>Buying unlocks once {mf} replies to your message, or after your free intro call.</Small> : null}</Card>
        ) : null
      ) : null}

      <Small>Times are in your time zone{localZone() ? ` (${localZone().replace(/_/g, " ")})` : ""}.</Small>
      {q.loading && !d ? <Loading label="Loading open times" /> : null}
      {q.error && !d ? <LoadError error={q.error} onRetry={q.reload} title="Couldn’t load open times" /> : null}
      {d && !d.slots.length ? (
        <Card><Note>{d.hasAvailability === false ? `${mf} hasn’t set call hours yet. Message them to find a time.` : `No open times in the next ${d.bookingWindowDays || 60} days. Message ${mf} to find one.`}</Note></Card>
      ) : null}
      {d?.slots.length ? <SlotPicker slots={d.slots} value={slot} onChange={setSlot} /> : null}
      {d?.slots.length ? <Small>Moving a call inside 24 hours needs a reason. The Join button opens 10 minutes before the start.</Small> : null}
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      <Btn kind="dark" disabled={!slot || busy || tooShort} label={busy ? "Booking…" : !slot ? "Pick a time" : payPerCall ? `Book and pay ${dollars(price)}` : `Book ${fmtWhen(slot)}`} onPress={book} />
    </Screen>
  );
}
