import { useRouter } from "expo-router";
import { View } from "react-native";
import { GuideSheet } from "../../../components/shared";
import { Btn, Card, Chip, Eyebrow, Grow, Link, Note, Row, Screen, Sec, SS, Stat, Stats, T, TT } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";
import { money } from "../../../lib/sample";
import { useColors } from "../../../lib/theme";

export default function MentorHome() {
  const router = useRouter();
  const c = useColors();
  const { s } = useDemo();
  const { openSheet } = useOverlay();
  const dot = <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} />;
  return (
    <Screen>
      <View style={{ gap: 4 }}><Eyebrow>Mentor</Eyebrow><T>Hi, Jordan</T></View>
      <Stats>
        <Stat label="Earned this month (not yet paid)" value={money(s.pay.earnedMonth)} onPress={() => router.push("/mentor/payouts")} />
        <Stat label="Next payout" value={s.pay.next} onPress={() => router.push("/mentor/payouts")} />
      </Stats>
      {s.paused ? <Card tone="warn"><TT>Your profile is paused</TT><Note>Students can’t find or buy from you.</Note><Link label="Turn it back on" onPress={() => router.push("/mentor/settings")} /></Card> : null}
      <Sec>
        <Eyebrow>Needs your attention</Eyebrow>
        <View>
          <Row left={dot} tt="Reply to Sofia Alvarez" ss="New student message · 3 hours ago" onPress={() => router.push("/mentor/chat/jordan")} />
          <Row left={dot} tt={`Maya Lin has ${s.mPk.maya.hours - s.mPk.maya.used} hour${s.mPk.maya.hours - s.mPk.maya.used === 1 ? "" : "s"} left`} ss="Secondaries · 10-hour package" onPress={() => router.push("/mentor/package/maya")} />
          <Row left={dot} tt="Finish your profile" ss="85% · add a fun fact and your clients’ schools" onPress={() => router.push("/mentor/profile")} last />
        </View>
      </Sec>
      <Sec>
        <Eyebrow>Today</Eyebrow>
        <Card row><Grow><TT>Free intro call · Sam Torres</TT><SS>5:30 PM ET · 15 min · recorded</SS></Grow><Btn kind="dark" sm label="Join" onPress={() => router.push("/call/sam")} /></Card>
        <Card row><Grow><TT>Maya Lin · Secondaries</TT><SS>8:00 PM ET · 1 hour</SS></Grow><Chip label="Running low" tone="warn" /></Card>
      </Sec>
      <Card tone="tint" onPress={() => openSheet(GuideSheet)}><TT>Not Sure How To Structure Your Offers?</TT><Note>See example packages, when hourly work fits, and freelancing notes.</Note></Card>
    </Screen>
  );
}
