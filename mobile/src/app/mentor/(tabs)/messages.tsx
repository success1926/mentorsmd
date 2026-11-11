import { useRouter } from "expo-router";
import { View } from "react-native";
import { Av, Row, Screen, SS, T } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";
import { initials, MENTOR_STUDENT_NAMES } from "../../../lib/sample";
import { useColors } from "../../../lib/theme";

const WHEN: Record<string, [string, boolean]> = { jordan: ["3h", true], maya: ["5h", true], priya: ["Yesterday", false], sam: ["Mon", false] };

export default function MentorMessages() {
  const router = useRouter();
  const c = useColors();
  const { s } = useDemo();
  const ids = Object.keys(s.mThreads);
  return (
    <Screen>
      <T>Messages</T>
      <View>
        {ids.map((k, i) => {
          const n = MENTOR_STUDENT_NAMES[k];
          const t = s.mThreads[k];
          const last = t[t.length - 1];
          const [when, unread] = WHEN[k] || ["Now", false];
          return (
            <Row key={k} left={<Av init={initials(n)} size={36} />} tt={n} ss={<SS numberOfLines={1}>{last?.[0] === "me" ? "You: " : ""}{last?.[1]}</SS>}
              rr={<View style={{ alignItems: "flex-end", gap: 4 }}><SS>{when}</SS>{unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}</View>}
              chevron={false} last={i === ids.length - 1} onPress={() => router.push(`/mentor/chat/${k}`)} />
          );
        })}
      </View>
    </Screen>
  );
}
