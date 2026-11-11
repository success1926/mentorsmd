import { useLocalSearchParams } from "expo-router";
import { Btn, Card, Hdr, KV, Screen } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";
import { money, sampleMentor } from "../../../lib/sample";

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s } = useDemo();
  const { toast } = useOverlay();
  const p = s.pk[id];
  if (!p) return null;
  const m = sampleMentor(p.mentor)!;
  const total = p.hours * m.rate;
  const cr = id === "p3" ? 60 : 0;
  return (
    <Screen>
      <Hdr title="Receipt" sub={`Order ${id.toUpperCase()}-2026`} />
      <Card>
        <KV k={p.title} v={money(total)} />
        <KV k="Mentor" v={m.name} />
        {cr ? <KV k="MentorsMD credit" v={`−${money(cr)}`} /> : null}
        <KV k="Paid" v={money(total - cr)} total />
        <KV k="Card" v="Visa •••• 4242 (example)" />
      </Card>
      <Btn kind="line" label="Email me this receipt" onPress={() => toast("Receipt emailed (example)")} />
    </Screen>
  );
}
