import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafetySheet } from "../../../components/safety";
import { Bar, Btn, Card, Chip, Eyebrow, Field, H, Hdr, KV, Link, Loading, Note, Row, RowV, Screen, Sec, SecH, Seg, Small, SS, TT } from "../../../components/ui";
import {
  CallSheet, DayChips, DayGrid, ErrText, ErrorBox, FEE_PERCENT, PackageChip, TOP_UP_HOURS, WarningsCard, dayString, dayWord, finishPhase, firstName, fmtDay, fmtTime, hoursLabel,
  hoursSummary, hoursToRespond, isLowOnHours, joinState, markCompleteBlocker, mentorShare, minutesBetween, priceFor, shortHours, useConfirm, useReloadOnFocus, warningsOf, type Warning,
} from "../../../components/mentorSheets";
import { api, dollars, errorText, useApi } from "../../../lib/api";
import { useOverlay } from "../../../lib/demo";
import { useColors } from "../../../lib/theme";

const KIND_LABEL: Record<string, string> = { HOURLY: "Hourly", BUNDLE: "Hour bundle", SPECIALIZED: "Specialized package", PAY_PER_CALL: "Pay-per-call" };

// One package (the website's /orders/[id] for the mentor): hours used and
// left, log written work, suggest more hours, calls, the hours log and
// "Mark work complete". Orders from before hourly pricing show their due
// date (which the mentor can change) and are marked complete with a note.
export default function MentorPackage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<{ order: any }>(`/api/orders/${encodeURIComponent(id)}`);
  useReloadOnFocus(q.reload);
  const o = q.data?.order;
  if (q.loading && !o) return <Screen><Hdr title="Package" /><Loading /></Screen>;
  if (!o) return <Screen><Hdr title="Package" /><ErrorBox error={q.error || "Package not found"} onRetry={q.reload} /></Screen>;
  return o.kind ? <HoursPackage o={o} reload={q.reload} /> : <OlderOrder o={o} reload={q.reload} />;
}

function Safety({ o, reload }: { o: any; reload: () => void }) {
  const safety = useSafetySheet();
  const name = o.buyer?.name || "Student";
  return (
    <Sec>
      <Link label={`Report or block ${firstName(name) || "this student"}`} onPress={() => safety({ userId: o.buyerId, name, conversationId: o.conversationId || undefined, orderId: o.id }, () => reload())} />
      <Small>Asked to do something you’re not comfortable with? Tell us privately. You can also block them, which stops messages and calls until we’ve looked into it.</Small>
    </Sec>
  );
}

function HoursPackage({ o, reload }: { o: any; reload: () => void }) {
  const c = useColors();
  const router = useRouter();
  const { openSheet, toast } = useOverlay();
  const confirm = useConfirm();
  const phase = finishPhase(o);
  const h = hoursSummary(o);
  const title = o.packageTitle || o.gig?.title || "Package";
  const who = firstName(o.buyer?.name) || "The student";
  const upcoming = h.upcoming;
  const blocker = markCompleteBlocker({ ...o, upcomingCalls: upcoming.length });
  const earned = mentorShare(priceFor(h.used, o.rateCents || 0));
  const unused = mentorShare(priceFor(h.left, o.rateCents || 0));
  const left = hoursToRespond(o);

  const markComplete = () =>
    confirm({
      title: `Mark ${title} Complete?`,
      body: `${who} then has 48 hours to approve it or ask for one last call or revision.`,
      confirmLabel: "Mark complete",
      onConfirm: async () => {
        await api(`/api/orders/${encodeURIComponent(o.id)}/finish`, { body: { action: "MARK_COMPLETE" } });
        toast(`${who} has 48 hours to respond`);
        reload();
      },
    });

  return (
    <Screen>
      <Hdr title={o.buyer?.name || "Student"} sub={`${KIND_LABEL[o.kind] || "Package"} · ${title}`} />
      <RowV gap={6} style={{ flexWrap: "wrap" }}>
        <PackageChip order={o} />
        {o.buyer?.minorStatus ? <Chip label="Under 18" tone="gray" /> : null}
        {isLowOnHours(o) ? <Chip label="Running low" tone="warn" /> : null}
      </RowV>
      {o.buyer?.minorStatus ? <Card tone="tint"><TT>Student under 18</TT><Note>Their parent gave consent and gets a receipt for every order. Calls are recorded.</Note></Card> : null}

      {phase === "AWAITING_STUDENT" && left !== null ? (
        <Card tone="tint"><Note ink>You marked this complete. {who} has {left} hours to respond; it’s approved automatically after that.</Note></Card>
      ) : null}
      {phase === "WORKING" && o.lastRequestNote && (o.lastCallUsedAt || o.lastRevisionUsedAt) ? (
        <Card tone="warn">
          <TT>{who} asked for {o.lastCallUsedAt ? "one last call" : "one last revision"}</TT>
          <Note ink>{o.lastRequestNote}</Note>
          <Small>When it’s done, mark the work complete again. They’ll then have 48 hours to approve.</Small>
        </Card>
      ) : null}
      {phase === "DISPUTED" ? <Card tone="danger"><TT>Disputed</TT><Note>This order has an open dispute. An admin will resolve it. Hours on this package are held until the dispute is decided.</Note></Card> : null}
      {phase === "APPROVED" ? <Card tone="tint"><Note ink>{o.autoApproved ? "Approved automatically after 48 hours." : "Approved."} Your earnings for it, including unused hours, are paid with the monthly payout on the 24th.</Note></Card> : null}

      <Card>
        <SecH><TT>Hours</TT>{o.rateCents ? <SS>{dollars(o.rateCents)} an hour</SS> : null}</SecH>
        <Bar pct={h.purchased ? ((h.used + h.reserved) / h.purchased) * 100 : 0} />
        <SS>{shortHours(h.used)} used · {shortHours(h.left)} left of {shortHours(h.purchased)}{h.reserved ? ` · ${shortHours(h.reserved)} booked` : ""}</SS>
        <SS>Calls {shortHours(h.usedCalls)} · Written {shortHours(h.usedWritten)} · Calls held: {h.callsHeld}</SS>
        {isLowOnHours(o) ? <Card tone="warn" style={{ padding: 12 }}><Note style={{ color: c.warnFg }}>{who} has {shortHours(h.left)} left (booked calls count as used). We’ve emailed them a reminder that they can add hours. If the work needs more time than that, suggest how many more hours you expect.</Note></Card> : null}
      </Card>

      {phase === "WORKING" ? (
        <>
          <Btn kind="dark" label="Log written work" disabled={h.left < 30} onPress={() => openSheet(() => <LogWorkSheet o={o} onLogged={reload} />)} />
          {h.left < 30 ? <Small>No hours left to log. The student can add hours.</Small> : null}
          <Btn kind="line" label="Suggest more hours" onPress={() => openSheet(() => <SuggestHoursSheet o={o} />)} />
        </>
      ) : null}
      {o.conversationId ? <Btn kind="line" label={`Message ${who}`} onPress={() => router.push(`/mentor/chat/${o.conversationId}`)} /> : null}

      {upcoming.length ? (
        <Sec>
          <Eyebrow>Calls</Eyebrow>
          <View>
            {upcoming.map((b: any, i: number) => {
              const open = joinState(b) === "open";
              const call = { ...b, kind: b.kind || "ORDER", orderId: o.id, disputed: o.disputed, withName: o.buyer?.name };
              return (
                <Row key={b.id} tt={`${dayWord(b.startTime)} · ${fmtTime(b.startTime)} to ${fmtTime(b.endTime)}`} ss={open ? "Your call is open. Join now." : "Join opens 10 minutes before the start"}
                  rr={open ? <Btn kind="dark" sm label="Join" onPress={() => router.push(`/call/${b.id}`)} /> : undefined}
                  onPress={() => openSheet(() => <CallSheet call={call} onChanged={reload} />)} last={i === upcoming.length - 1} />
              );
            })}
          </View>
          <Small>Tap a call to reschedule or cancel it.</Small>
        </Sec>
      ) : null}

      <Sec>
        <Eyebrow>Hours log</Eyebrow>
        {(o.hourEntries || []).length ? (
          <View>
            {(o.hourEntries as any[]).map((e) => (
              <View key={e.id} style={{ opacity: e.voidedAt ? 0.55 : 1 }}>
                <KV kInk line k={`${e.type === "CALL" ? "Call" : "Written"}${e.note ? `: ${e.note}` : ""}`} v={`${shortHours(e.minutes)} · ${fmtDay(e.workDate)}`} />
                {e.fileName ? <Small>File: {e.fileName}</Small> : null}
                {e.voidedAt ? <Small>Taken back (doesn’t count)</Small> : null}
              </View>
            ))}
          </View>
        ) : <Note>Nothing logged yet. Held calls are added automatically; log written work here.</Note>}
      </Sec>

      <Card>
        <TT>Your totals</TT>
        <View>
          <KV k="Hours used" v={shortHours(h.used)} />
          <KV k="Hours left" v={shortHours(h.left)} />
          <KV k="Calls held" v={String(h.callsHeld)} />
          <KV k="Earned so far" v={dollars(earned)} />
          {h.left > 0 && phase !== "CLOSED" ? <KV k="Unused hours, paid on approval" v={dollars(unused)} /> : null}
        </View>
        <Small>You earn {100 - FEE_PERCENT}% of each hour, paid monthly on the 24th.</Small>
      </Card>

      {phase === "WORKING" ? (
        <Card>
          <Btn kind="black" label="Mark work complete" disabled={!!blocker} onPress={markComplete} />
          <Small>{blocker || "When you’re done (any time). The student then has 48 hours to approve, or to ask for one last call or revision."}</Small>
        </Card>
      ) : null}

      <Card>
        <TT>Details</TT>
        <View>
          <KV k="Bought" v={`${hoursLabel(o.minutesPurchased - (o.topUps || []).reduce((s: number, t: any) => s + t.minutes, 0))} · ${dollars(o.amount)}`} />
          {(o.topUps || []).map((t: any) => <KV key={t.id} k={`Hours added ${t.paidAt ? fmtDay(t.paidAt) : ""}`} v={`${hoursLabel(t.minutes)} · ${dollars(t.amountCents)}`} />)}
          <KV k="Started" v={fmtDay(o.paidAt || o.createdAt)} />
        </View>
        {o.packageDescription ? <Note>{o.packageDescription}</Note> : null}
        {(o.files || []).length ? <Small>{o.files.length} shared file{o.files.length === 1 ? "" : "s"}. Open them on mentorsmd.com.</Small> : null}
      </Card>

      <Safety o={o} reload={reload} />
    </Screen>
  );
}

// Log written work: { minutes: 30 | 60, workDate, note } (/api/orders/[id]/hours).
function LogWorkSheet({ o, onLogged }: { o: any; onLogged: () => void }) {
  const { closeSheet, toast } = useOverlay();
  const left = hoursSummary(o).left;
  const [minutes, setMinutes] = useState<30 | 60>(left >= 60 ? 60 : 30);
  const [day, setDay] = useState(dayString(new Date()));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (note.trim().length < 3) return setError("Add a short note about what you worked on");
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${encodeURIComponent(o.id)}/hours`, { body: { minutes, workDate: day, note: note.trim() } });
      closeSheet();
      toast(`Logged ${minutes} minutes. ${firstName(o.buyer?.name) || "The student"} gets an email.`);
      onLogged();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <H>Log Written Work</H>
      <Seg options={([30, 60] as const).filter((m) => m <= left).map((m) => [m, `${m} min`] as [30 | 60, string])} value={minutes} onChange={setMinutes} />
      <Small>The day you did the work</Small>
      <DayChips value={day} onChange={setDay} from={-13} to={0} />
      <Field label="What you worked on" value={note} onChange={setNote} multiline placeholder="E.g. Edited the second draft of the personal statement." />
      <Small>{shortHours(left)} left to log (booked calls count as used). The student sees every entry on their package page. To attach a file, log the work on mentorsmd.com.</Small>
      <ErrText>{error}</ErrText>
      <Btn kind="dark" label={busy ? "Saving…" : `Log ${minutes} minutes`} disabled={busy || minutes > left} onPress={save} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}

// Suggest more hours: posts in the package's messages and emails the
// student a one-click "Add hours" (/api/orders/[id]/suggest-hours).
function SuggestHoursSheet({ o }: { o: any }) {
  const { closeSheet } = useOverlay();
  const [hours, setHours] = useState(2);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Warning[] | null>(null);
  const [sent, setSent] = useState(false);
  const student = firstName(o.buyer?.name) || "your student";
  const rate = o.rateCents || 0;
  const send = async (ack = false) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${encodeURIComponent(o.id)}/suggest-hours`, { body: { hours, note: note.trim(), acknowledgeWarnings: ack } });
      setSent(true);
    } catch (e) {
      const w = warningsOf(e);
      if (w) setWarnings(w);
      else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (sent)
    return (
      <>
        <H>Sent</H>
        <Note>We posted it in your messages with {student} and emailed them a button to add {hoursLabel(hours * 60)}. Nothing is charged unless they add them.</Note>
        <Btn kind="dark" label="Done" onPress={closeSheet} />
      </>
    );
  return (
    <>
      <H>Suggest More Hours</H>
      <Note>If the work will take longer than the hours left, let {student} know how many more you expect. They can add them in one click, at this package’s rate.</Note>
      <Seg options={TOP_UP_HOURS.map((n) => [n, `${n} h`] as [number, string])} value={hours} onChange={setHours} />
      {rate > 0 ? <SS>{hoursLabel(hours * 60)} × {dollars(rate)}/hr = {dollars(priceFor(hours * 60, rate))} for {student}</SS> : null}
      <Field label="Why, in a sentence (optional)" value={note} onChange={setNote} multiline placeholder="E.g. The secondaries for your top three schools will take about three more hours." />
      {warnings ? <WarningsCard warnings={warnings} busy={busy} onEdit={() => setWarnings(null)} onSendAnyway={() => send(true)} /> : null}
      <ErrText>{error}</ErrText>
      <Btn kind="dark" label={busy ? "Sending…" : `Suggest ${hours} hour${hours === 1 ? "" : "s"}`} disabled={busy} onPress={() => send(false)} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}

// ---------- orders from before hourly pricing ----------
function OlderOrder({ o, reload }: { o: any; reload: () => void }) {
  const router = useRouter();
  const { openSheet } = useOverlay();
  const who = firstName(o.buyer?.name) || "The student";
  const active = o.status === "IN_ESCROW";
  const upcoming = (o.callBookings || []).filter((b: any) => b.status === "BOOKED" && new Date(b.endTime) > new Date());
  return (
    <Screen>
      <Hdr title={o.buyer?.name || "Student"} sub={o.gig?.title} />
      <RowV gap={6}><PackageChip order={o} />{o.buyer?.minorStatus ? <Chip label="Under 18" tone="gray" /> : null}</RowV>
      {o.status === "COMPLETED" ? <Card tone="tint"><Note ink>You marked this complete. Waiting for {who} to approve it.</Note></Card> : null}
      {o.revisionRequested && o.revisionNote ? <Card tone="warn"><TT>{who} asked for a revision</TT><Note ink>{o.revisionNote}</Note></Card> : null}
      {o.disputed ? <Card tone="danger"><Note>This order has an open dispute. An admin will resolve it.</Note></Card> : null}
      <Card>
        <View>
          <KV k="Price" v={dollars(o.amount)} />
          <KV k="Due" v={o.dueDate ? fmtDay(o.dueDate) : "None"} />
          <KV k="Ordered" v={fmtDay(o.createdAt)} />
        </View>
        {["IN_ESCROW", "COMPLETED"].includes(o.status) ? (
          <>
            <Link label="Change due date" onPress={() => openSheet(() => <DueDateSheet o={o} onSaved={reload} />)} />
            <Small>A revision request sets the due date to 7 days out. Use this if you need longer, or to give the student more time to book a call.</Small>
          </>
        ) : null}
      </Card>
      {upcoming.length ? (
        <Sec>
          <Eyebrow>Calls</Eyebrow>
          <View>
            {upcoming.map((b: any, i: number) => {
              const open = joinState(b) === "open";
              return (
                <Row key={b.id} tt={`${dayWord(b.startTime)} · ${fmtTime(b.startTime)}`} ss={`${minutesBetween(b.startTime, b.endTime)} min`}
                  rr={open ? <Btn kind="dark" sm label="Join" onPress={() => router.push(`/call/${b.id}`)} /> : undefined}
                  onPress={() => openSheet(() => <CallSheet call={{ ...b, kind: "ORDER", orderId: o.id, disputed: o.disputed, withName: o.buyer?.name }} onChanged={reload} />)} last={i === upcoming.length - 1} />
              );
            })}
          </View>
        </Sec>
      ) : null}
      {o.conversationId ? <Btn kind="line" label={`Message ${who}`} onPress={() => router.push(`/mentor/chat/${o.conversationId}`)} /> : null}
      {active && !o.disputed ? <Btn kind="black" label="Mark complete" onPress={() => openSheet(() => <DeliverSheet o={o} onDone={reload} />)} /> : null}
      <Safety o={o} reload={reload} />
    </Screen>
  );
}

function DueDateSheet({ o, onSaved }: { o: any; onSaved: () => void }) {
  const { closeSheet, toast } = useOverlay();
  const [day, setDay] = useState<string | null>(o.dueDate ? String(o.dueDate).slice(0, 10) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!day) return setError("Pick a date.");
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${encodeURIComponent(o.id)}/due-date`, { body: { dueDate: `${day}T12:00:00.000Z` } });
      closeSheet();
      toast("Due date saved");
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <H>Change Due Date</H>
      <DayGrid start={day} minDay={dayString(new Date())} onChange={(s) => setDay(s)} />
      <ErrText>{error}</ErrText>
      <Btn kind="dark" label={busy ? "Saving…" : "Save due date"} disabled={busy || !day} onPress={save} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}

// Older orders are marked complete with a short description of what was
// delivered (/api/orders/[id]/mark-complete). Files can be added on the website.
function DeliverSheet({ o, onDone }: { o: any; onDone: () => void }) {
  const { closeSheet, toast } = useOverlay();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    if (text.trim().length < 20) return setError("Describe what you're delivering (at least 20 characters).");
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${encodeURIComponent(o.id)}/mark-complete`, { body: { description: text.trim(), files: [] } });
      closeSheet();
      toast("Marked complete. The student got an email.");
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <H>Mark Complete</H>
      <Field label="What you’re delivering" value={text} onChange={setText} multiline placeholder="At least 20 characters" />
      <Small>To attach files, mark it complete on mentorsmd.com.</Small>
      <ErrText>{error}</ErrText>
      <Btn kind="dark" label={busy ? "Sending…" : "Mark complete"} disabled={busy} onPress={go} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}
