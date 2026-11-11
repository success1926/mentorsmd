import { View } from "react-native";
import { Eyebrow, Hdr, KV, Note, Screen, Sec, Stat } from "../../components/ui";
import { useDemo } from "../../lib/demo";
import { money } from "../../lib/sample";
import { useColors } from "../../lib/theme";

export default function Credit() {
  const { s } = useDemo();
  const c = useColors();
  return (
    <Screen>
      <Hdr title="MentorsMD Credit" />
      <View style={{ flexDirection: "row" }}><Stat label="Your balance" value={money(s.credit)} /></View>
      <Note>Credit is used first at checkout. It doesn’t expire, and it can’t be cashed out.</Note>
      <Sec>
        <Eyebrow>History</Eyebrow>
        <View>
          <KV k="Gift from Anita Shah" v="+$100" vColor={c.okFg} kInk />
          <KV k="Used on School list & strategy" v="−$60" kInk />
          {s.credit < 40 ? <KV k="Used at checkout" v={`−${money(40 - s.credit)}`} kInk /> : null}
        </View>
      </Sec>
    </Screen>
  );
}
