import { useRouter } from "expo-router";
import { View } from "react-native";
import { FlagSheet } from "../../../components/adminSheets";
import { Chip, Eyebrow, KV, Note, Row, Screen, Sec, Stat, Stats, T } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";

export default function Overview() {
  const router = useRouter();
  const { s } = useDemo();
  const { openSheet } = useOverlay();
  const newApps = s.apps.filter((x) => x.status === "New");
  const openD = s.disputes.filter((d) => d.status === "Open").length;
  const pendMin = s.minors.filter((x) => !x.ok);
  return (
    <Screen>
      <View style={{ gap: 4 }}><Eyebrow>Admin</Eyebrow><T>Overview</T></View>
      <Note>What needs attention right now. Everything else is in the menu or on the website.</Note>
      <Sec>
        <Eyebrow>Needs attention</Eyebrow>
        <View>
          {openD ? <Row tt={`${openD} open dispute`} ss="Chris Nguyen · mentor missed two calls" rr={<Chip label="Urgent" tone="bad" />} onPress={() => router.push("/admin/dispute/d1")} /> : null}
          {newApps.length ? <Row tt={`${newApps.length} new mentor application${newApps.length === 1 ? "" : "s"}`} ss={newApps.map((a) => a.name).join(", ")} onPress={() => router.push("/admin/applications")} /> : null}
          {pendMin.length ? <Row tt={`${pendMin.length} under-18 consent not signed`} ss={pendMin.map((m) => m.n).join(", ")} onPress={() => router.push("/admin/minors")} /> : null}
          <Row tt="1 message flagged" ss="Possible contact details shared · Maya ↔ Jordan" onPress={() => openSheet(FlagSheet)} last />
        </View>
      </Sec>
      <Sec>
        <Eyebrow>At a glance · view only</Eyebrow>
        <Stats>
          <Stat label="Sales this month" value="$8,640" />
          <Stat label="Held for students" value="$3,480" />
          <Stat label="Listed mentors" value="14" />
          <Stat label="Calls this week" value="22" />
        </Stats>
      </Sec>
      <Sec>
        <Eyebrow>Latest activity</Eyebrow>
        <View>
          {s.log.slice(0, 3).map(([w, x], i) => <KV key={i} k={`${w}: ${x}`} v="Now" kInk />)}
          <KV k="Jordan Ellis marked Priya’s package complete" v="2h" kInk />
          <KV k="Ethan Cole started checkout" v="4h" kInk />
          <KV k="New lead: Hannah W. (waitlist)" v="6h" kInk />
        </View>
      </Sec>
    </Screen>
  );
}
