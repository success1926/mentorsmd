import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Card, Eyebrow, Hdr, Note, RowV, SchoolList, Screen, Sec, Small, SS, Stars } from "../components/ui";
import { ACCEPTED, sampleMentor } from "../lib/sample";
import { fonts, useColors } from "../lib/theme";

const DIST: [number, number][] = [[5, 61], [4, 10], [3, 2], [2, 1], [1, 0]];
const RV: [string, string, string, string][] = [
  ["Marcus T.", "Accepted to Georgetown", "leah", "Jordan helped me turn ten years of jobs into one story. I got 4 interviews as a reapplicant."],
  ["Elena R.", "Accepted to Mount Sinai", "ben", "Three mock MMIs with Ben and the real day felt easy."],
  ["Devon K.", "Accepted to Ohio State", "aaron", "A realistic school list. I got into a target in October."],
  ["Riya S.", "Admitted to a BS/MD program", "nina", "Nina made the interview feel like a conversation."],
];

export default function Reviews() {
  const c = useColors();
  const router = useRouter();
  return (
    <Screen>
      <Hdr title="Reviews" sub="What students say (sample)" />
      <Card>
        <RowV gap={16}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontFamily: "Newsreader_300Light", fontSize: 48, lineHeight: 52, color: c.ink }}>4.9</Text>
            <Stars>★★★★★</Stars>
            <Small>74 reviews</Small>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            {DIST.map(([n, k]) => (
              <RowV key={n} gap={8}>
                <Text style={{ width: 28, fontFamily: fonts.body, fontSize: 12, color: c.ink }}>{n} ★</Text>
                <View style={{ flex: 1, height: 6, borderRadius: 9, backgroundColor: c.line, overflow: "hidden" }}><View style={{ width: `${(k / 61) * 100}%`, height: "100%", backgroundColor: c.primary }} /></View>
                <Small style={{ width: 24, textAlign: "right" }}>{k}</Small>
              </RowV>
            ))}
          </View>
        </RowV>
      </Card>
      <Sec><Eyebrow>Where our students have been accepted</Eyebrow><SchoolList schools={ACCEPTED} /></Sec>
      <Sec>
        <Eyebrow>Student reviews</Eyebrow>
        {RV.map(([w, d, id, t]) => (
          <Card key={w} onPress={() => router.push(`/profile/${id}`)}>
            <Stars>★★★★★</Stars>
            <Note ink>“{t}”</Note>
            <SS>{w} · {d} · Mentor: {sampleMentor(id)!.name}</SS>
          </Card>
        ))}
      </Sec>
    </Screen>
  );
}
