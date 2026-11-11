import { View } from "react-native";
import { SettingsBody } from "../../components/shared";
import { Hdr, Screen, Toggle } from "../../components/ui";
import { useDemo, useOverlay } from "../../lib/demo";

export default function MentorSettings() {
  const { s, change } = useDemo();
  const { toast } = useOverlay();
  return (
    <Screen>
      <Hdr title="Settings" />
      <View>
        <Toggle tt="Pause my profile" ss="Hide from Find a mentor. Current students can still reach you." value={s.paused}
          onChange={(v) => { change((n) => { n.paused = v; }); toast(v ? "Profile paused" : "Profile is live again"); }} />
        <Toggle tt="Work with students under 18" ss="They need a parent’s consent first" value={s.minorsOk} onChange={(v) => change((n) => { n.minorsOk = v; })} last />
      </View>
      <SettingsBody role="mentor" />
    </Screen>
  );
}
