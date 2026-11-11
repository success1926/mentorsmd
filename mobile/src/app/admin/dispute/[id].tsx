import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Btn, Btns2, Bubble, Card, Composer, Half, Hdr, Link, Note, Screen, Small, TT } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";
import { money } from "../../../lib/sample";

// A dispute: the three-way conversation, then refund or release (Face ID first).
export default function AdminDispute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, change } = useDemo();
  const { toast, faceId } = useOverlay();
  const [sent, setSent] = useState<string[]>([]);
  const d = s.disputes.find((x) => x.id === id);
  if (!d) return null;
  const open = d.status === "Open";
  const decide = (refund: boolean) =>
    faceId(() => {
      change((n) => {
        n.disputes.find((x) => x.id === id)!.status = refund ? "Refunded in full" : "Released to mentor";
        n.orders.find((o) => o.id === "o2")!.st = refund ? "REFUNDED" : "RELEASED";
        n.log.unshift(["Taylor Reed", refund ? `Refunded ${d.student} (${money(d.amount)})` : `Released ${d.order} to ${d.mentor}`, "Now"]);
      });
      toast(refund ? `Refunded ${money(d.amount)} to ${d.student} as MentorsMD credit` : `Released to ${d.mentor}`);
    });
  return (
    <Screen footer={open ? <Composer placeholder="Reply to both" onSend={(t) => { setSent((x) => [...x, t]); toast("Reply sent"); }} /> : undefined}>
      <Hdr title="Dispute" sub={d.order} />
      <Card tone={open ? "danger" : "tint"}>
        <TT>{d.reason}</TT>
        <Note>{d.student} (student) vs {d.mentor} (mentor) · {money(d.amount)} held · 6.5 hours unused</Note>
        {!open ? <TT>{d.status}</TT> : null}
      </Card>
      <Small>Two mentor no-shows: the policy is a full refund.</Small>
      <View style={{ gap: 8 }}>
        {d.convo.map(([w, x], i) => <Bubble key={i} who={w === "admin" ? "me" : "them"}>{w === "admin" ? x : `${w === "student" ? d.student : d.mentor}: ${x}`}</Bubble>)}
        {sent.map((x, i) => <Bubble key={"s" + i} who="me">{x}</Bubble>)}
      </View>
      {open ? (
        <>
          <Btns2>
            <Half><Btn kind="red" label="Refund student" onPress={() => decide(true)} /></Half>
            <Half><Btn kind="line" label="Release to mentor" onPress={() => decide(false)} /></Half>
          </Btns2>
          <Link label="Partial refund" onPress={() => toast("Partial refund opens on the website (example)")} />
        </>
      ) : null}
    </Screen>
  );
}
