import { View } from "react-native";
import { Chip, Hdr, Row, Screen, Small } from "../../components/ui";

export default function AdminPayouts() {
  return (
    <Screen>
      <Hdr title="Payouts" sub="View only" />
      <View>
        <Row tt="Jordan Ellis" ss="Nov 24 · ready" rr="$1,176" />
        <Row tt="Ben Okafor" ss="Nov 24 · ready" rr="$2,436" />
        <Row tt="Sofia Marquez" ss="Nov 24 · Stripe needs a document" rr={<Chip label="On hold" tone="warn" />} last />
      </View>
      <Small>Payout changes stay on the website.</Small>
    </Screen>
  );
}
