import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Btn, Bubble, Composer, Field, Hdr, Note, Screen, Select, Small } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";

const REASONS = ["The work is not what we agreed on", "My mentor missed a call", "My mentor stopped replying", "Something else"];

export default function Dispute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, change } = useDemo();
  const { toast } = useOverlay();
  const [reason, setReason] = useState(REASONS[0]);
  const [text, setText] = useState("The final draft still has the research paragraph we agreed to cut, and I haven't heard back in 3 days.");
  const [sent, setSent] = useState<string[]>([]);
  const p = s.pk[id];
  if (!p) return null;
  if (p.status === "DISPUTE")
    return (
      <Screen footer={<Composer placeholder="Message the MentorsMD team" onSend={(t) => { setSent((x) => [...x, t]); toast("Sent to the MentorsMD team"); }} />}>
        <Hdr title="Dispute" sub={p.title} />
        <Bubble who="sys">Dispute opened Nov 11 · An admin replies within 1 business day</Bubble>
        <Bubble who="me">{p.disputeText || "The work is not what we agreed on."}</Bubble>
        <Bubble who="them">Taylor, MentorsMD team: Thanks Priya. I’m reading the package log and messages now and will reply by tomorrow.</Bubble>
        {sent.map((t, i) => <Bubble key={i} who="me">{t}</Bubble>)}
      </Screen>
    );
  return (
    <Screen>
      <Hdr title="Open a Dispute" sub={p.title} />
      <Note>A MentorsMD admin steps in, looks at what happened, and can refund your payment. Your mentor won’t be paid while it’s open.</Note>
      <Select label="What went wrong?" options={REASONS} value={reason} onChange={setReason} />
      <Field label="Tell us more" value={text} onChange={setText} multiline />
      <Small>Two mentor no-shows: the policy is a full refund.</Small>
      <Btn kind="red" label="Open dispute" onPress={() => { change((n) => { n.pk[id].status = "DISPUTE"; n.pk[id].disputeText = `${reason}. ${text}`; }); toast("Dispute opened. An admin will reply soon."); }} />
    </Screen>
  );
}
