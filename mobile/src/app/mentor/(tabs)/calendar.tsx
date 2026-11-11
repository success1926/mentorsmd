import { useRouter } from "expo-router";
import { View } from "react-native";
import { MoveSheet } from "../../../components/shared";
import { Eyebrow, Link, Row, Screen, Sec, SecH, Seg, Small, T, Toggle } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";

const HOURS: [string, string][] = [["Mon", "6:00 – 9:00 PM"], ["Tue", "6:00 – 9:00 PM"], ["Wed", "Not available"], ["Thu", "6:00 – 9:00 PM"], ["Fri", "Not available"], ["Sat", "10:00 AM – 2:00 PM"], ["Sun", "Not available"]];

export default function MentorCalendar() {
  const router = useRouter();
  const { s, change } = useDemo();
  const { toast, openSheet } = useOverlay();
  return (
    <Screen>
      <T>Calendar & Availability</T>
      <Sec>
        <Eyebrow>Upcoming calls</Eyebrow>
        <View>
          <Row tt="Sam Torres · Free intro call" ss="Today · 5:30 PM ET · 15 min" rr="Join" onPress={() => router.push("/call/sam")} />
          <Row tt="Maya Lin · Secondaries" ss="Today · 8:00 PM ET · 1 hour" onPress={() => openSheet(MoveSheet)} />
          <Row tt="Alex Kim · BS/MD interview prep" ss="Sat, Nov 14 · 11:00 AM ET · parent may join" onPress={() => openSheet(MoveSheet)} last />
        </View>
      </Sec>
      <Sec>
        <SecH><Eyebrow>Call hours</Eyebrow><Link label="Edit" onPress={() => toast("Edit call hours (example)")} /></SecH>
        <View>{HOURS.map(([d, h], i) => <Row key={d} tt={d} rr={h} last={i === HOURS.length - 1} />)}</View>
        <Small>Eastern Time (New York). Students see times in their own time zone.</Small>
      </Sec>
      <Sec>
        <Eyebrow>Booking window</Eyebrow>
        <Seg options={[7, 14, 30, 60, 90].map((n) => [n, `${n} days`] as [number, string])} value={s.window}
          onChange={(n) => { change((x) => { x.window = n; }); toast(`Students can book up to ${n} days ahead`); }} />
      </Sec>
      <Sec>
        <Eyebrow>Busy dates</Eyebrow>
        <View><Row tt="Nov 25 – Nov 29" ss="Thanksgiving" onPress={() => toast("Remove busy dates (example)")} last /></View>
        <Link label="Add busy dates" onPress={() => toast("Add busy dates (example)")} />
      </Sec>
      <Toggle tt="Google Calendar" ss="Busy times in Google block bookings here" value={s.gcal} onChange={(v) => change((x) => { x.gcal = v; })} last />
    </Screen>
  );
}
