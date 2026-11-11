import { useLocalSearchParams } from "expo-router";
import { Btn, Card, Chip, Eyebrow, Hdr, KV, Note, Screen, Sec } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";

export default function Application() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, change } = useDemo();
  const { toast } = useOverlay();
  const x = s.apps.find((a) => a.id === id);
  if (!x) return null;
  const set = (st: string, msg: string) => { change((n) => { n.apps.find((a) => a.id === id)!.status = st; n.log.unshift(["Taylor Reed", `${st === "Invited" ? "Sent invite to" : "Declined"} ${x.name}`, "Now"]); }); toast(msg); };
  return (
    <Screen>
      <Hdr title={x.name} sub={`Applied ${x.applied}`} />
      <Card>
        <KV k="Stage" v={x.stage} />
        <KV k="School" v={x.school} />
        <KV k="Wants to offer" v={x.svc} />
        <KV k="Senior team" v={x.interviews} />
      </Card>
      <Sec><Eyebrow>Why they want to mentor</Eyebrow><Note ink>“I had no one to ask when I applied. I want to be the person I needed, especially for first-gen applicants.”</Note></Sec>
      <Chip label={x.status} tone={x.status === "Invited" ? "ok" : x.status === "Declined" ? "bad" : "gray"} />
      {x.status === "Invited" || x.status === "Declined" ? null : (
        <>
          <Btn kind="dark" label="Send mentor invite" onPress={() => set("Invited", "Invite sent")} />
          <Btn kind="line" label="Decline" onPress={() => set("Declined", "Application declined")} />
        </>
      )}
    </Screen>
  );
}
