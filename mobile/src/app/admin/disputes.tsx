import { useRouter } from "expo-router";
import { View } from "react-native";
import { FlagSheet } from "../../components/adminSheets";
import { Chip, Hdr, Row, Screen } from "../../components/ui";
import { useDemo, useOverlay } from "../../lib/demo";
import { money } from "../../lib/sample";

export default function Disputes() {
  const router = useRouter();
  const { s } = useDemo();
  const { openSheet } = useOverlay();
  return (
    <Screen>
      <Hdr title="Disputes & Flags" />
      <View>
        {s.disputes.map((d) => <Row key={d.id} tt={`${d.student} vs ${d.mentor}`} ss={`${d.order} · ${money(d.amount)} · opened ${d.opened}`} rr={<Chip label={d.status} tone={d.status === "Open" ? "bad" : "gray"} />} onPress={() => router.push(`/admin/dispute/${d.id}`)} />)}
        <Row tt="Flagged message" ss="Maya Lin ↔ Jordan Ellis · phone number shared" rr={<Chip label="Flag" tone="warn" />} onPress={() => openSheet(FlagSheet)} last />
      </View>
    </Screen>
  );
}
