import { View } from "react-native";
import { Btn, Chip, Hdr, Note, Row, Screen } from "../../components/ui";
import { useOverlay } from "../../lib/demo";

export default function Results() {
  const { toast } = useOverlay();
  return (
    <Screen>
      <Hdr title="Cycle Results" />
      <Note>Tell us how your cycle went. Mentors see results from their own students only.</Note>
      <View>
        <Row tt="Emory University School of Medicine" ss="Interview · Oct 30" rr={<Chip label="Interview" />} onPress={() => toast("Edit result (example)")} />
        <Row tt="Duke University School of Medicine" ss="Secondary sent" rr={<Chip label="Applied" tone="gray" />} onPress={() => toast("Edit result (example)")} last />
      </View>
      <Btn kind="line" label="Add a school" onPress={() => toast("Add a school (example)")} />
    </Screen>
  );
}
