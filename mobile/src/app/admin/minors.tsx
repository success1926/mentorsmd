import { Btn, Card, Chip, Hdr, Note, RowV, Screen, SS, TT } from "../../components/ui";
import { useDemo, useOverlay } from "../../lib/demo";

export default function Minors() {
  const { s } = useDemo();
  const { toast } = useOverlay();
  return (
    <Screen>
      <Hdr title="Under 18" />
      <Note>Students under 18 need a parent’s signed consent before they can message or book.</Note>
      {s.minors.map((x) => (
        <Card key={x.n}>
          <RowV style={{ justifyContent: "space-between" }}><TT>{x.n}</TT><Chip label={x.ok ? "Consent on file" : "Waiting"} tone={x.ok ? "ok" : "warn"} /></RowV>
          <SS>{x.a} · {x.p}</SS>
          <SS>{x.s}</SS>
          {x.ok ? null : <Btn kind="line" sm label="Resend consent email" onPress={() => toast(`Consent email sent again to ${x.p.replace("Parent: ", "")}`)} />}
        </Card>
      ))}
    </Screen>
  );
}
