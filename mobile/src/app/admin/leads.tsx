import { useRouter } from "expo-router";
import { View } from "react-native";
import { LeadSheet } from "../../components/adminSheets";
import { Hdr, Row, Screen } from "../../components/ui";
import { useDemo, useOverlay } from "../../lib/demo";

export default function Leads() {
  const router = useRouter();
  const { s } = useDemo();
  const { openSheet } = useOverlay();
  return (
    <Screen>
      <Hdr title="Leads" />
      <View>
        {s.leads.map(([n, sub, w]) => <Row key={n} tt={n} ss={sub} rr={w} onPress={() => openSheet(() => <LeadSheet name={n} />)} />)}
        <Row tt="Calls & recordings" ss="22 calls this week · 3 recordings to keep" onPress={() => router.push("/admin/calls")} last />
      </View>
    </Screen>
  );
}
