import { useRouter } from "expo-router";
import { View } from "react-native";
import { Hdr, Row, Screen } from "../../components/ui";
import { money } from "../../lib/sample";

export default function Receipts() {
  const router = useRouter();
  return (
    <Screen>
      <Hdr title="Receipts" />
      <View>
        <Row tt="Personal statement · 6 hours" ss="Jordan Ellis · Oct 20" rr={money(900)} onPress={() => router.push("/student/receipt/p1")} />
        <Row tt="Interview prep · 6 hours" ss="Ben Okafor · Oct 29" rr={money(900)} onPress={() => router.push("/student/receipt/p2")} />
        <Row tt="School list & strategy · 3 hours" ss="Sofia Marquez · Sep 10" rr={money(195)} onPress={() => router.push("/student/receipt/p3")} last />
      </View>
    </Screen>
  );
}
