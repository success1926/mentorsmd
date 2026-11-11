import { View } from "react-native";
import { Hdr, Row, Screen } from "../../components/ui";
import { useDemo } from "../../lib/demo";

export default function ActionLog() {
  const { s } = useDemo();
  const rows: [string, string, string][] = [...s.log, ["Taylor Reed", "Sent invite to Omar Haddad", "Nov 10"], ["Tabitha Q.", "Edited the Homepage", "Nov 9"], ["Taylor Reed", "Refunded Hana Sato ($255)", "Nov 6"]];
  return (
    <Screen>
      <Hdr title="Action Log" sub="View only" />
      <View>{rows.map(([w, x, d], i) => <Row key={i} tt={x} ss={w} rr={d} last={i === rows.length - 1} />)}</View>
    </Screen>
  );
}
