import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { usePaySheet } from "../../../components/shared";
import { Bar, Btn, Btns2, Card, Eyebrow, Field, H, Half, Hdr, KV, Link, Note, Row, RowV, Screen, Sec, SecH, Small, SS, Stat3, TT } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";
import { first, money, sampleMentor } from "../../../lib/sample";
import { useColors } from "../../../lib/theme";

// A student's package: approve / last call / last revision / dispute, hours, log, files.
export default function Package() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { s, change } = useDemo();
  const { toast, openSheet } = useOverlay();
  const pay = usePaySheet();
  const p = s.pk[id];
  if (!p) return null;
  const m = sampleMentor(p.mentor)!;
  const mf = first(m.name);
  const left = p.hours - p.used;
  const set = (fn: (x: typeof p) => void) => change((n) => fn(n.pk[id]));

  let top = null;
  if (p.status === "COMPLETED")
    top = (
      <Card tone="warn">
        <TT>{mf} marked this package complete</TT>
        <Note>You have {p.left} hours to choose. If you do nothing, it’s approved automatically.</Note>
        <Btn label="Approve" onPress={() => { set((x) => { x.status = "RELEASED"; }); toast(`Approved. Payment released to ${mf}.`); }} />
        <Btns2>
          <Half><Btn kind="line" label="One last call" onPress={() => { set((x) => { x.status = "REVISION"; x.revKind = "call"; }); toast("Asked for one last call"); }} /></Half>
          <Half><Btn kind="line" label="One last revision" onPress={() => { set((x) => { x.status = "REVISION"; x.revKind = "revision"; }); toast("Asked for one last revision"); }} /></Half>
        </Btns2>
        <Link red label="Something’s wrong? Open a dispute" onPress={() => router.push(`/student/dispute/${id}`)} />
      </Card>
    );
  else if (p.status === "REVISION")
    top = <Card tone="tint"><TT>Revision requested</TT><Note>{mf} will send one last {p.revKind}. You’ll get another 48 hours to approve after that.</Note></Card>;
  else if (p.status === "RELEASED")
    top = (
      <Card tone="tint">
        <TT>Approved. Thank you!</TT>
        <Note>Payment released to {mf}.</Note>
        {p.reviewed ? <Small>You left a 5-star review.</Small> : <Btn label="Leave a review" onPress={() => openSheet(() => <ReviewSheet id={id} />)} />}
      </Card>
    );
  else if (p.status === "DISPUTE")
    top = <Card tone="danger"><TT>Dispute open</TT><Note>A MentorsMD admin is looking at this order. Nothing is released while it’s open.</Note><Btn kind="line" label="Open the conversation" onPress={() => router.push(`/student/dispute/${id}`)} /></Card>;
  else
    top = (
      <Btns2>
        <Half><Btn kind="dark" label="Book a call" onPress={() => router.push(`/student/book?m=${p.mentor}&kind=hours`)} /></Half>
        <Half><Btn kind="line" label="Message" onPress={() => router.push(`/student/chat/${p.mentor}`)} /></Half>
      </Btns2>
    );

  return (
    <Screen>
      <Hdr title={`${p.title.split(" · ")[0]} package`} sub={`with ${m.name}`} />
      {top}
      <Card>
        <SecH><TT>Hours</TT><SS>{p.used} of {p.hours} used</SS></SecH>
        <Bar pct={(p.used / p.hours) * 100} />
        <RowV gap={8}><Stat3 value={String(left)} label="Hours left" /><Stat3 value={String(p.calls)} label="Calls held" /><Stat3 value={String(p.used)} label="Hours used" /></RowV>
        {p.status === "IN_ESCROW" ? <Link label="Add more hours" onPress={() => pay(m, "2 more hours", m.rate * 2)} /> : null}
      </Card>
      <Sec>
        <Eyebrow>Hours log</Eyebrow>
        {p.log.length ? <View>{p.log.map(([t, h, d], i) => <KV key={i} k={t} v={`${h} · ${d}`} kInk line />)}</View> : <Note>Nothing logged yet. Your mentor logs every call and written hour here.</Note>}
      </Sec>
      <Sec>
        <Eyebrow>Files</Eyebrow>
        <View><Row tt="Personal statement, draft 3 (with comments)" ss="PDF · added Nov 9" onPress={() => toast("Opens the file (example)")} last /></View>
      </Sec>
      <RowV gap={4}><Small>Order {id.toUpperCase()}-2026 · Paid {money(p.hours * m.rate)} ·</Small><Link label="Receipt" onPress={() => router.push(`/student/receipt/${id}`)} /></RowV>
    </Screen>
  );
}

function ReviewSheet({ id }: { id: string }) {
  const { s, change } = useDemo();
  const { closeSheet, toast } = useOverlay();
  const m = sampleMentor(s.pk[id].mentor)!;
  const [v, setV] = useState(`${first(m.name)} helped me find my story. Clear, kind and fast.`);
  return (
    <>
      <H>Review {m.name}</H>
      <TT style={{ fontSize: 30, lineHeight: 36, color: useColors().primary }}>★★★★★</TT>
      <Field label="What was it like?" value={v} onChange={setV} multiline />
      <Btn kind="dark" label="Post review" onPress={() => { change((n) => { n.pk[id].reviewed = true; }); closeSheet(); toast("Review posted. Thank you!"); }} />
    </>
  );
}
