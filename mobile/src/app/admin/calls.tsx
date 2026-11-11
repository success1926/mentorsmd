import { View } from "react-native";
import { Chip, Hdr, Row, Screen } from "../../components/ui";
import { useOverlay } from "../../lib/demo";

export default function Calls() {
  const { toast } = useOverlay();
  return (
    <Screen>
      <Hdr title="Calls & Recordings" />
      <View>
        <Row tt="Jordan Ellis ↔ Sam Torres" ss="Today 5:30 PM · intro call" rr="Upcoming" onPress={() => toast("Opens call details (example)")} />
        <Row tt="Aaron Feld ↔ Chris Nguyen" ss="Nov 8 · mentor didn’t join" rr={<Chip label="No-show" tone="bad" />} onPress={() => toast("Opens call details (example)")} />
        <Row tt="Ben Okafor ↔ Priya Shah" ss="Nov 7 · 1.5 h · recorded" rr="Watch" onPress={() => toast("Plays the recording (example)")} last />
      </View>
    </Screen>
  );
}
