import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Bar, Btn, Btns2, Card, Eyebrow, Field, H, Half, Hdr, KV, Note, Screen, Sec, SecH, Select, Seg, Small, SS, TT } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";
import { first, money } from "../../../lib/sample";

const TIME: [string, number][] = [["30 min", 0.5], ["1 hour", 1], ["1.5 hours", 1.5], ["2 hours", 2]];

export default function MentorPackage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { s, change } = useDemo();
  const { toast, openSheet } = useOverlay();
  const p = s.mPk[id];
  if (!p) return null;
  const sf = first(p.student);
  const acts =
    p.status === "IN_ESCROW" ? (
      <>
        <Btn kind="dark" label="Log work" onPress={() => openSheet(() => <LogWork id={id} />)} />
        <Btns2>
          <Half><Btn kind="line" label="Message student" onPress={() => router.push(`/mentor/chat/${id}`)} /></Half>
          <Half><Btn kind="line" label="Change due date" onPress={() => openSheet(() => <DueSheet id={id} />)} /></Half>
        </Btns2>
        <Btn label="Mark complete" onPress={() => { change((n) => { n.mPk[id].status = "COMPLETED"; }); toast(`${sf} has 48 hours to approve`); }} />
        <Small>When you mark it complete, {sf} has 48 hours to approve it or ask for one last call or revision.</Small>
      </>
    ) : p.status === "COMPLETED" ? (
      <Card tone="warn"><TT>Waiting for {sf} to approve</TT><Note>47 hours left. If they do nothing, it’s approved and your pay is released.</Note></Card>
    ) : (
      <Card tone="tint"><TT>Approved and paid out</TT><Note>You earned {money(p.hours * s.rate * 0.7)} after the 30% fee.</Note></Card>
    );
  return (
    <Screen>
      <Hdr title={p.student} sub={p.title} />
      {p.minor ? <Card tone="tint"><TT>Student under 18</TT><Note>Parent consent is on file. Calls are recorded and a parent can join.</Note></Card> : null}
      {acts}
      <Card><SecH><TT>Hours</TT><SS>{p.used} of {p.hours} used</SS></SecH><Bar pct={(p.used / p.hours) * 100} /></Card>
      <Sec>
        <Eyebrow>Hours log</Eyebrow>
        <View>
          <KV k="Written feedback: Emory secondary" v="1.5 h · Nov 9" kInk line />
          <KV k="Call: Duke “why us”" v="1 h · Nov 6" kInk line />
          <KV k="Written feedback: 4 short answers" v="2 h · Nov 2" kInk line />
        </View>
      </Sec>
    </Screen>
  );
}

function LogWork({ id }: { id: string }) {
  const { s, change } = useDemo();
  const { closeSheet, toast } = useOverlay();
  const p = s.mPk[id];
  const [kind, setKind] = useState<"written" | "call">("written");
  const [time, setTime] = useState("1 hour");
  const [what, setWhat] = useState("Written feedback: Duke secondary, round 2");
  return (
    <>
      <H>Log Work · {p.student}</H>
      <Seg options={[["written", "Written work"], ["call", "Call"]]} value={kind} onChange={setKind} />
      <Select label="Time spent" options={TIME.map((t) => t[0])} value={time} onChange={setTime} />
      <Field label="What you did" value={what} onChange={setWhat} />
      <Small>{first(p.student)} sees every entry on their package page.</Small>
      <Btn kind="dark" label="Log it" onPress={() => {
        const h = TIME.find((t) => t[0] === time)![1];
        change((n) => { n.mPk[id].used = Math.min(n.mPk[id].hours, n.mPk[id].used + h); });
        closeSheet(); toast(`Logged ${time}`);
      }} />
    </>
  );
}

function DueSheet({ id }: { id: string }) {
  const { s } = useDemo();
  const { closeSheet, toast } = useOverlay();
  const [d, setD] = useState("Nov 27, 2026");
  const [r, setR] = useState("Waiting on two more secondaries");
  const sf = first(s.mPk[id].student);
  return (
    <>
      <H>Change Due Date</H>
      <Field label="New due date" value={d} onChange={setD} />
      <Field label="Reason (shown to the student)" value={r} onChange={setR} />
      <Btn kind="dark" label={`Ask ${sf} to agree`} onPress={() => { closeSheet(); toast(`Due date change sent to ${sf}`); }} />
    </>
  );
}
