import { useRouter } from "expo-router";
import { View } from "react-native";
import { Av, Row, Screen, Small, SS, T } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";
import { sampleMentor } from "../../../lib/sample";
import { useColors } from "../../../lib/theme";

const WHEN: Record<string, [string, boolean]> = { leah: ["2h", true], ben: ["Yesterday", false], sofia: ["Oct 2", false] };

export default function Messages() {
  const router = useRouter();
  const c = useColors();
  const { s } = useDemo();
  const ids = Object.keys(s.threads).filter((k) => s.threads[k].length);
  return (
    <Screen>
      <T>Messages</T>
      <View>
        {ids.map((id, i) => {
          const m = sampleMentor(id)!;
          const t = s.threads[id];
          const last = t[t.length - 1];
          const [when, unread] = WHEN[id] || ["Now", false];
          return (
            <Row key={id} left={<Av init={m.init} size={36} />} tt={m.name} ss={<SS numberOfLines={1}>{last[0] === "me" ? "You: " : ""}{last[1]}</SS>}
              rr={<View style={{ alignItems: "flex-end", gap: 4 }}><SS>{when}</SS>{unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}</View>}
              chevron={false} last={i === ids.length - 1} onPress={() => router.push(`/student/chat/${id}`)} />
          );
        })}
      </View>
      <Small>Keep payments and contact details on MentorsMD. Messages are checked for safety.</Small>
    </Screen>
  );
}
