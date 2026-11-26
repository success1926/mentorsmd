import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafetySheet } from "../../../components/safety";
import { useConfirm } from "../../../components/mentorSheets";
import { CallCard, MoveSheet, useRefresh, usePaySheet, type CalCall } from "../../../components/shared";
import { Bar, Btn, Btns2, Card, Chip, Collapsible, Eyebrow, Field, H, Half, Hdr, KV, Link, LoadError, Loading, Note, RowV, Screen, Sec, SecH, Small, SS, Stat3, StatusBadge, TT } from "../../../components/ui";
import { api, dollars, errorText, SITE, useApi } from "../../../lib/api";
import { useOverlay } from "../../../lib/overlay";
import { callMinutes, finishPhase, hoursLabel, hoursSummary, hoursToRespond, joinState, lastRequestAvailable, LOW_HOURS_MINUTES, pkgTitle, priceFor, RECORDING_NOTICE, shortHours, splitCredit, TOP_UP_HOURS, type Pkg } from "../../../lib/orders";
import { fonts, useColors } from "../../../lib/theme";
import { firstName, fmtDateTime, fmtDay } from "../../../lib/format";

const KIND_LABEL: Record<string, string> = { HOURLY: "Hourly", BUNDLE: "Hour bundle", SPECIALIZED: "Specialized package", PAY_PER_CALL: "Pay-per-call" };
const OUTCOME: Record<string, string> = { HELD: "Held", STUDENT_NO_SHOW: "You didn’t join (hours used)", MENTOR_NO_SHOW: "Your mentor didn’t join (no hours used)", NOBODY_JOINED: "Nobody joined", UNCLEAR: "Being checked by the MentorsMD team", FREE_REBOOK: "Free rebook (no hours used)" };

// One of the student's packages (/api/orders/[id]): the 48-hour decision,
// hours, booking calls from the hours, adding hours, calls, the hours log,
// a dispute and the review, like the website's package page.
export default function Package() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const router = useRouter();
  const { openSheet, toast } = useOverlay();
  const safety = useSafetySheet();
  const pay = usePaySheet();
  const q = useApi<{ order: Pkg }>(`/api/orders/${encodeURIComponent(id)}`);
  const o = q.data?.order;
  // Still confirming the payment: check every 3 seconds.
  useRefresh(q.reload, o?.status === "PENDING_PAYMENT" ? 3000 : undefined);

  if (!o)
    return (
      <Screen>
        <Hdr title="Package" />
        {q.loading ? <Loading /> : q.error ? <LoadError error={q.error} onRetry={q.reload} title="Couldn’t load this package" /> : null}
      </Screen>
    );

  const phase = finishPhase(o);
  const h = hoursSummary(o);
  const mentor = o.seller;
  const mf = firstName(mentor?.name) || "Your mentor";
  const title = pkgTitle(o);
  const now = Date.now();
  const calls = (o.callBookings || []).filter((b) => b.status !== "CANCELLED");
  const upcoming = calls.filter((b) => b.status === "BOOKED" && new Date(b.endTime).getTime() > now);
  const past = calls.filter((b) => joinState(b) === "ended");
  const asCal = (b: (typeof calls)[number]): CalCall => ({ id: b.id, startTime: b.startTime, endTime: b.endTime, orderId: o.id, kind: b.kind, title, withName: mentor?.name || "", withId: o.sellerId, withRole: "mentor" });
  const takenSlot = o.kind === "PAY_PER_CALL" && !!o.requestedCallStart && !calls.some((b) => b.status === "BOOKED");
  const bookHref = `/student/book?m=${encodeURIComponent(o.sellerId)}&o=${encodeURIComponent(o.id)}&kind=hours&name=${encodeURIComponent(mentor?.name || "")}&left=${h.left}`;
  const topUps = o.topUps || [];
  const bought = o.minutesPurchased - topUps.reduce((s, t) => s + t.minutes, 0);

  const addHours = () => openSheet(() => <AddHoursSheet order={o} onPick={(hours) => pay({
    what: { type: "hours", orderId: o.id, hours },
    title: `${hoursLabel(hours * 60)} more: ${title}`,
    mentorName: mentor?.name || "",
    priceCents: priceFor(hours * 60, o.rateCents || 0),
    onPaid: () => q.reload(),
    onChecking: () => q.reload(),
  })} />);

  return (
    <Screen>
      <Hdr title={title} sub={`${KIND_LABEL[o.kind || ""] || "Package"} · with ${mentor?.name || ""}`} />
      <RowV><StatusBadge order={o} audience="student" /></RowV>

      {phase === "PAYING" ? <Card tone="tint"><Note ink>Confirming your payment with Stripe… this page updates in a few seconds.</Note></Card> : null}
      {takenSlot ? (
        <Card tone="warn">
          <Note style={{ color: c.warnFg }}>Your call is paid for, but the time you picked ({fmtDateTime(o.requestedCallStart)}) was taken while you were paying. Please pick another time.</Note>
          <Btn sm label="Pick a new time" onPress={() => router.push(bookHref)} />
        </Card>
      ) : null}

      {phase === "AWAITING_STUDENT" ? <Decision order={o} onChanged={q.reload} /> : null}

      {phase === "WORKING" && o.lastRequestNote && (o.lastCallUsedAt || o.lastRevisionUsedAt) ? (
        <Card tone="tint">
          <TT>You asked for {o.lastCallUsedAt ? "one last call" : "one last revision"}</TT>
          <Note>{o.lastRequestNote}</Note>
          <Small>When your mentor marks the work complete again, you’ll have 48 hours to approve.</Small>
        </Card>
      ) : null}

      {phase === "APPROVED" ? <Card tone="tint"><TT>{o.autoApproved ? "Approved automatically after 48 hours." : "Approved."}</TT><Note>Thanks for working with MentorsMD.</Note></Card> : null}
      {phase === "APPROVED" && !o.review ? <ReviewCard order={o} onDone={q.reload} /> : null}
      {phase === "APPROVED" && o.review ? <Small>You left a {o.review.rating}-star review. Thank you!</Small> : null}

      {phase === "DISPUTED" ? (
        <Card tone="danger">
          <TT>Dispute open</TT>
          <Note>An admin reviews it and decides. Your mentor isn’t paid while it’s open. Reply there if they ask for more details.</Note>
          <Btn kind="line" label="Open the conversation with the MentorsMD team" onPress={() => router.push(`/student/dispute/${o.id}`)} />
        </Card>
      ) : null}
      {phase === "CLOSED" ? <Card><Note>{o.status === "REFUNDED" ? "This package was refunded." : "This package was cancelled."}{o.refundedCreditCents ? ` ${dollars(o.refundedCreditCents)} came back to you as MentorsMD credit.` : ""}</Note></Card> : null}

      {phase === "WORKING" ? (
        <Btns2>
          <Half><Btn kind="dark" label="Book a call" disabled={h.left < 30} onPress={() => router.push(bookHref)} /></Half>
          <Half><Btn kind="line" label="Message" disabled={!o.conversationId} onPress={() => router.push(`/student/chat/${o.conversationId}`)} /></Half>
        </Btns2>
      ) : o.conversationId && phase !== "PAYING" ? <Btn kind="line" label={`Message ${mf}`} onPress={() => router.push(`/student/chat/${o.conversationId}`)} /> : null}

      <Card>
        <SecH><TT>Hours</TT>{o.rateCents ? <SS>{dollars(o.rateCents)} an hour</SS> : null}</SecH>
        <RowV style={{ alignItems: "baseline" }} gap={6}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 30, color: c.ink }}>{shortHours(h.left)}</Text>
          <SS>left of {shortHours(h.purchased)}</SS>
        </RowV>
        <Bar pct={h.purchased ? ((h.purchased - h.left) / h.purchased) * 100 : 0} />
        <RowV gap={8}>
          <Stat3 value={shortHours(h.used)} label="Hours used" />
          <Stat3 value={String(h.callsHeld)} label="Calls held" />
          <Stat3 value={shortHours(h.reserved)} label="Booked" />
        </RowV>
        {phase === "WORKING" ? <Small>{h.left >= 30 ? "Calls are 30 or 60 minutes, on your mentor’s calendar. No payment needed." : "No hours left for a call."}</Small> : null}
        {(phase === "WORKING" || phase === "AWAITING_STUDENT") && o.rateCents ? (
          <Card tone={h.left <= LOW_HOURS_MINUTES ? "warn" : "tint"}>
            <Note ink>{h.left <= LOW_HOURS_MINUTES ? `Running low? You have ${shortHours(h.left)} left.` : "Need more time? Add hours at the same rate."}</Note>
            <Btn sm kind="line" label="Add hours" onPress={addHours} />
          </Card>
        ) : null}
      </Card>

      {upcoming.length || past.length ? (
        <Sec>
          <Eyebrow>Calls</Eyebrow>
          {upcoming.map((b) => <CallCard key={b.id} call={asCal(b)} onMove={phase === "WORKING" ? () => openSheet(() => <MoveSheet call={asCal(b)} onChanged={q.reload} />) : undefined} />)}
          {past.length ? (
            <Collapsible title="Past calls" count={past.length}>
              <View>
                {past.map((b, i) => (
                  <KV key={b.id} k={`${fmtDateTime(b.startTime)} · ${callMinutes(b)} min`} v={OUTCOME[b.outcome || ""] || "Waiting for the outcome"} kInk line={i < past.length - 1} />
                ))}
              </View>
            </Collapsible>
          ) : null}
          <Small>{RECORDING_NOTICE}</Small>
        </Sec>
      ) : null}

      {(o.hourEntries || []).length ? (
        <Collapsible title="Hours log" count={(o.hourEntries || []).length}>
          <View>
            {(o.hourEntries || []).map((e) => (
              <View key={e.id} style={{ paddingVertical: 10, gap: 2, opacity: e.voidedAt ? 0.55 : 1, borderBottomWidth: 1, borderColor: c.line }}>
                <RowV gap={8}><Chip label={e.type === "CALL" ? "Call" : "Written"} tone={e.type === "CALL" ? "plain" : "gray"} /><TT style={{ fontSize: 14 }}>{e.minutes} min · {fmtDay(e.workDate)}</TT></RowV>
                <Small>{e.loggedBy?.name ? `Logged by ${e.loggedBy.name}` : e.type === "CALL" ? "Added automatically" : ""}{e.fileName ? ` · File: ${e.fileName}` : ""}</Small>
                {e.note ? <Note>{e.note}</Note> : null}
                {e.voidedAt ? <Small>Taken back (doesn’t count)</Small> : null}
              </View>
            ))}
          </View>
        </Collapsible>
      ) : (
        <Sec>
          <Eyebrow>Hours log</Eyebrow>
          <Note>Nothing logged yet. Held calls are added automatically; your mentor logs written work here.</Note>
        </Sec>
      )}

      {(o.files || []).length ? (
        <Sec>
          <Eyebrow>Shared files</Eyebrow>
          <View>{(o.files || []).map((f, i) => <KV key={f.id} k={f.attachmentName || "File"} v={fmtDay(f.createdAt)} kInk line={i < (o.files || []).length - 1} />)}</View>
          <Link label="Open files on mentorsmd.com" onPress={() => WebBrowser.openBrowserAsync(`${SITE}/orders/${o.id}`)} />
        </Sec>
      ) : null}

      <Card>
        <KV k="Bought" v={`${hoursLabel(bought)} · ${dollars(o.amount)}`} />
        {topUps.map((t) => <KV key={t.id} k={`Hours added ${fmtDay(t.paidAt)}`} v={`${hoursLabel(t.minutes)}${t.amountCents != null ? ` · ${dollars(t.amountCents)}` : ""}`} />)}
        {o.creditAppliedCents > 0 ? <KV k="Credit applied" v={dollars(o.creditAppliedCents)} /> : null}
        <KV k="Started" v={fmtDay(o.paidAt || o.createdAt)} />
        {o.packageDescription ? <><Small style={{ marginTop: 6 }}>What’s included</Small><Note>{o.packageDescription}</Note></> : null}
        <Link label="Receipt" onPress={() => router.push(`/student/receipt/${o.id}`)} />
      </Card>

      {phase === "WORKING" ? (
        <Sec>
          <Small>Something wrong? Message your mentor first. If that doesn’t sort it out:</Small>
          <Link red label="Report a problem (open a dispute)" onPress={() => router.push(`/student/dispute/${o.id}`)} />
        </Sec>
      ) : null}
      <Link label={`Report or block ${mf}`} onPress={() => safety({ userId: o.sellerId, name: mentor?.name || "Mentor", orderId: o.id, conversationId: o.conversationId || undefined }, () => toast("Upcoming calls with them can be cancelled any time"))} />
    </Screen>
  );
}

// "Jordan marked this package complete": approve, one last call or
// revision (once), or open a dispute.
function Decision({ order, onChanged }: { order: Pkg; onChanged: () => void }) {
  const c = useColors();
  const router = useRouter();
  const { openSheet, toast } = useOverlay();
  const confirm = useConfirm();
  const left = hoursToRespond(order);
  const extra = lastRequestAvailable(order);
  const mf = firstName(order.seller?.name) || "Your mentor";
  const approve = () =>
    confirm({
      title: `Approve ${pkgTitle(order)}?`,
      body: `${mf} is paid for the hours, including any unused ones.`,
      confirmLabel: "Approve",
      cancelLabel: "Not yet",
      onConfirm: async () => {
        await api(`/api/orders/${order.id}/finish`, { body: { action: "APPROVE", note: "" } });
        toast("Approved. Thanks for working with MentorsMD.");
        onChanged();
      },
    });
  const ask = (mode: LastRequest) => openSheet(() => <LastRequestSheet order={order} mode={mode} onDone={onChanged} />);
  return (
    <Card tone="warn">
      <TT>{mf} marked this package complete</TT>
      <Note style={{ color: c.warnFg }}>
        You have {left} hours to respond. If you don’t, it’s approved automatically.{extra ? " You can ask for one last call or one last revision (once)." : ""} Any unused hours aren’t refunded (mentors aren’t penalised for finishing efficiently). If something isn’t right, open a dispute.
      </Note>
      <Btn label="Approve" onPress={approve} />
      {extra ? (
        <Btns2>
          <Half><Btn kind="line" label="One last call" onPress={() => ask("LAST_CALL")} /></Half>
          <Half><Btn kind="line" label="One last revision" onPress={() => ask("LAST_REVISION")} /></Half>
        </Btns2>
      ) : null}
      <Link red label="Something’s wrong? Open a dispute" onPress={() => router.push(`/student/dispute/${order.id}`)} />
    </Card>
  );
}

// One last call or revision: a short note to the mentor, in a sheet.
type LastRequest = "LAST_CALL" | "LAST_REVISION";
function LastRequestSheet({ order, mode, onDone }: { order: Pkg; mode: LastRequest; onDone: () => void }) {
  const c = useColors();
  const { closeSheet, toast } = useOverlay();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const call = mode === "LAST_CALL";
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/finish`, { body: { action: mode, note } });
      closeSheet();
      toast(call ? "Asked for one last call. Book it from this page." : "Asked for one last revision");
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <H>{call ? "One Last Call" : "One Last Revision"}</H>
      <Field label={call ? "What would you like to cover in the last call?" : "What would you like changed?"} value={note} onChange={setNote} multiline />
      {call ? <Small>Then book the call from this page. It uses the package’s hours; if none are left, add hours first.</Small> : null}
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      <Btn kind="dark" label={busy ? "Sending…" : call ? "Request one last call" : "Request one last revision"} disabled={busy || !note.trim()} onPress={send} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}

function ReviewCard({ order, onDone }: { order: Pkg; onDone: () => void }) {
  const c = useColors();
  const { toast } = useOverlay();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/review`, { body: { rating, comment: comment.trim() || undefined } });
      toast("Review posted. Thank you!");
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <TT>Leave a review for {firstName(order.seller?.name)}</TT>
      <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: rating === n }} accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`} onPress={() => setRating(n)} hitSlop={4}>
            <Text style={{ fontSize: 32, color: n <= rating ? c.primary : c.line }}>★</Text>
          </Pressable>
        ))}
      </View>
      <Field label="What was it like working together? (optional)" value={comment} onChange={setComment} multiline />
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      <Btn kind="dark" label={busy ? "Sending…" : "Submit review"} disabled={!rating || busy} onPress={submit} />
    </Card>
  );
}

// "Add hours": 1, 2, 3 or 5 hours at this package's rate.
function AddHoursSheet({ order, onPick }: { order: Pkg; onPick: (hours: number) => void }) {
  const { closeSheet } = useOverlay();
  const credit = useApi<{ balanceCents: number }>("/api/me/credit");
  const [hours, setHours] = useState(1);
  const rate = order.rateCents || 0;
  const price = priceFor(hours * 60, rate);
  const split = splitCredit(price, credit.data?.balanceCents || 0);
  return (
    <>
      <H>Add Hours</H>
      <Note>At this package’s rate, {dollars(rate)} an hour. The hours are added as soon as the payment goes through.</Note>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {TOP_UP_HOURS.map((x) => <View key={x} style={{ flex: 1 }}><Btn sm kind={hours === x ? "dark" : "line"} label={`${x} hr${x === 1 ? "" : "s"}`} onPress={() => setHours(x)} style={{ alignSelf: "stretch", paddingHorizontal: 4 }} /></View>)}
      </View>
      <Card tone="tint">
        <TT>{hoursLabel(hours * 60)} × {dollars(rate)}/hr = {dollars(price)}</TT>
        {split.creditCents > 0 ? <Note>Credit applied: {dollars(split.creditCents)}. {split.chargeCents === 0 ? "Nothing to pay by card." : `You pay ${dollars(split.chargeCents)} by card.`}</Note> : null}
        <Small>Unused hours aren’t refunded if you finish early; mentors aren’t penalised for working efficiently.</Small>
      </Card>
      <Btn kind="dark" label={`Add ${hours} hour${hours === 1 ? "" : "s"}`} disabled={!rate} onPress={() => { closeSheet(); setTimeout(() => onPick(hours), 350); }} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}
