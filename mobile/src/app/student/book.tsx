import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Btn, Hdr, Link, Note, RowV, Screen, Small } from "../../components/ui";
import { useOverlay } from "../../lib/demo";
import { first, sampleMentor } from "../../lib/sample";
import { fonts, useColors } from "../../lib/theme";

const DAYS: [string, string][] = [["WED", "12"], ["THU", "13"], ["FRI", "14"], ["MON", "17"], ["TUE", "18"], ["WED", "19"]];
const TIMES = ["4:00 PM", "4:30 PM", "5:30 PM", "6:00 PM", "7:30 PM", "8:00 PM"];

// Book a call: the free 15-minute intro, or an hour from a package.
export default function Book() {
  const { m: mid, kind } = useLocalSearchParams<{ m: string; kind: string }>();
  const c = useColors();
  const router = useRouter();
  const { toast } = useOverlay();
  const [day, setDay] = useState(1);
  const [slot, setSlot] = useState<string | null>(null);
  const m = sampleMentor(mid);
  if (!m) return null;
  const intro = kind === "intro";
  const pick = (on: boolean) => ({ borderWidth: 1, borderColor: on ? c.primary : c.line, backgroundColor: on ? c.primary : c.surface });
  return (
    <Screen>
      <Hdr title={intro ? "Free Intro Call" : "Book a Call"} sub={m.name} />
      <Note>{intro ? "15 minutes on video to see if you’re a good fit. Free, once per mentor. Calls are recorded for safety." : "1 hour, taken from your package hours."}</Note>
      <RowV gap={4}><Small>Your time zone: Eastern Time (New York) ·</Small><Link label="Change" onPress={() => toast("Time zone picker (example)")} /></RowV>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {DAYS.map(([d, n], i) => (
          <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: day === i }} onPress={() => { setDay(i); setSlot(null); }}
            style={[{ width: 56, borderRadius: 12, paddingVertical: 8, alignItems: "center" }, pick(day === i)]}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: day === i ? c.onPrimary : c.muted }}>{d}</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: day === i ? c.onPrimary : c.ink }}>{n}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TIMES.map((t) => (
          <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: slot === t }} onPress={() => setSlot(t)}
            style={[{ width: "31.5%", borderRadius: 10, paddingVertical: 10, alignItems: "center" }, pick(slot === t)]}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: slot === t ? c.onPrimary : c.ink }}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <Small>{first(m.name)} takes bookings up to 60 days ahead. Moving a call inside 24 hours needs a reason.</Small>
      <Btn kind="dark" disabled={!slot} label={slot ? `Book ${slot}` : "Pick a time"}
        onPress={() => { router.back(); toast(`${intro ? "Free intro call booked: " : "Call booked: "}${slot}. Added to your calendar.`); }} />
    </Screen>
  );
}
