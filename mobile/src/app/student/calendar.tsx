import { useRouter } from "expo-router";
import { View } from "react-native";
import { MoveSheet } from "../../components/shared";
import { Btn, Card, Chip, DateBox, Eyebrow, Grow, Hdr, Link, Row, Screen, Sec, SS, TT } from "../../components/ui";
import { useOverlay } from "../../lib/demo";

export default function Calendar() {
  const router = useRouter();
  const { toast, openSheet } = useOverlay();
  return (
    <Screen>
      <Hdr title="Calendar" />
      <Sec>
        <Eyebrow>Upcoming</Eyebrow>
        <Card row><DateBox dow="TUE" day="17" /><Grow><TT>Ben Okafor · Interview prep</TT><SS>7:00 PM ET · 1 hour</SS></Grow><Btn kind="dark" sm label="Join" onPress={() => router.push("/call/ben")} /></Card>
        <Card row><DateBox dow="THU" day="19" /><Grow><TT>James Whitfield · Free intro call</TT><SS>6:00 PM ET · 15 min</SS></Grow><Link label="Move" onPress={() => openSheet(MoveSheet)} /></Card>
      </Sec>
      <Sec>
        <Eyebrow>Past calls</Eyebrow>
        <View>
          <Row tt="Jordan Ellis · Story and structure" ss="Nov 4 · 1 hour · recording kept 30 days" rr="Watch" onPress={() => toast("Plays the recording (example)")} />
          <Row tt="Ben Okafor · MMI mock" ss="Nov 7 · 1.5 hours" rr="Watch" onPress={() => toast("Plays the recording (example)")} last />
        </View>
      </Sec>
      <Card tone="tint" row><Grow><TT>Calendar sync</TT><SS>Your MentorsMD calls show in Apple Calendar</SS></Grow><Chip label="On" tone="ok" /></Card>
    </Screen>
  );
}
