import { useRouter } from "expo-router";
import { View } from "react-native";
import { Eyebrow, Price, Row, Screen, Sec, Stat, Stats, StatusChip, T } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";
import { money } from "../../../lib/sample";

export default function Money() {
  const router = useRouter();
  const { s } = useDemo();
  return (
    <Screen>
      <T>Orders & Payouts</T>
      <Stats><Stat label="Held for students" value="$3,480" /><Stat label="Next payout · Nov 24" value="$5,712" /></Stats>
      <Sec>
        <Eyebrow>Orders</Eyebrow>
        <View>
          {s.orders.map((o) => (
            <Row key={o.id} tt={o.what} ss={o.who} rr={<View style={{ alignItems: "flex-end", gap: 4 }}><Price style={{ fontSize: 13 }}>{money(o.amt)}</Price><StatusChip status={o.st} /></View>} onPress={() => router.push(`/admin/order/${o.id}`)} />
          ))}
          <Row tt="Payouts" ss="View only · changes stay on the website" onPress={() => router.push("/admin/payouts")} last />
        </View>
      </Sec>
    </Screen>
  );
}
