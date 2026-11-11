import { useState } from "react";
import { Text, View } from "react-native";
import { GuideSheet } from "../../components/shared";
import { Btn, Card, Eyebrow, Field, Hdr, Link, Note, Price, Row, RowV, Screen, Sec, SecH, Small, SS, TT } from "../../components/ui";
import { useDemo, useOverlay } from "../../lib/demo";
import { money, sampleMentor } from "../../lib/sample";
import { fonts } from "../../lib/theme";

export default function Rates() {
  const { s, change } = useDemo();
  const { toast, openSheet } = useOverlay();
  const [rate, setRate] = useState(String(s.rate));
  const save = () => {
    const v = parseInt(rate, 10);
    if (!(v >= 50 && v <= 2000)) return toast("Rates are whole dollars, at least $50 an hour (up to $2,000)");
    change((n) => { n.rate = v; });
    toast(`Rate saved: ${money(v)}/hr`);
  };
  return (
    <Screen>
      <Hdr title="Rates & Packages" />
      <Card>
        <Field label="Your hourly rate (USD)" value={rate} onChange={setRate} numeric />
        <Small>Rates are whole dollars, at least $50 an hour (up to $2,000). Students pay MentorsMD for hours at your rate. You receive <Text style={{ fontFamily: fonts.bodyBold }}>{money(s.rate * 0.7)}</Text> an hour after the 30% MentorsMD fee.</Small>
        <Btn kind="line" sm label="Save rate" onPress={save} />
      </Card>
      <Sec>
        <SecH><Eyebrow>Hour bundles</Eyebrow><Link label="Add a bundle" onPress={() => { change((n) => { n.bundles.push([15, n.rate * 15]); }); toast("Added a 15-hour bundle"); }} /></SecH>
        <View>{s.bundles.map(([h, p], i) => <Row key={i} tt={`${h} hour${h === 1 ? "" : "s"}`} ss={`You receive ${money(p * 0.7)}`} rr={<Price>{money(p)}</Price>} last={i === s.bundles.length - 1} />)}</View>
      </Sec>
      <Sec>
        <SecH><Eyebrow>Specialized packages</Eyebrow><Link label="Add a package" onPress={() => toast("New package form (example)")} /></SecH>
        {sampleMentor("leah")!.pkgs.map(([t, d, p]) => (
          <Card key={t}><RowV style={{ justifyContent: "space-between" }}><TT style={{ flex: 1 }}>{t}</TT><Price>{money(p)}</Price></RowV><SS>{d}</SS></Card>
        ))}
      </Sec>
      <Card tone="tint" onPress={() => openSheet(GuideSheet)}><TT>Not Sure How To Structure Your Offers?</TT><Note>Open the guide</Note></Card>
    </Screen>
  );
}
