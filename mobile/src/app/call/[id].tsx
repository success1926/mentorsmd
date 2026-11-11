import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Av } from "../../components/ui";
import { useDemo, useOverlay } from "../../lib/demo";
import { sampleMentor } from "../../lib/sample";
import { fonts, useColors } from "../../lib/theme";

// A video call (the real one runs on Daily; this shows the layout).
export default function Call() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const router = useRouter();
  const { role } = useDemo();
  const { toast } = useOverlay();
  const m = sampleMentor(id) || { name: "Sam Torres", init: "ST" };
  const btn = (icon: "mic" | "video" | "phone-off", label: string, onPress: () => void, end?: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: end ? "#D92D20" : c.videoTile, alignItems: "center", justifyContent: "center" }}>
      <Feather name={icon} size={24} color="#fff" />
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.video }}>
      <View style={{ position: "absolute", left: 16, top: 60, backgroundColor: "rgba(180,35,24,0.9)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, zIndex: 2 }}>
        <Text style={{ color: "#fff", fontFamily: fonts.bodyBold, fontSize: 12 }}>● Recording</Text>
      </View>
      <View style={{ position: "absolute", right: 16, top: 60, width: 96, height: 130, borderRadius: 14, backgroundColor: c.videoTile, alignItems: "center", justifyContent: "center", zIndex: 2 }}>
        <Text style={{ color: "#fff", fontFamily: "Newsreader_400Regular", fontSize: 28 }}>{role === "mentor" ? "J" : "P"}</Text>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Av init={m.init} size={88} />
        <Text style={{ color: "#fff", fontFamily: fonts.bodyBold, fontSize: 18 }}>{m.name}</Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: fonts.body }}>00:12:48 · 47 min left</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 24 }}>
        {btn("mic", "Mute", () => toast("Muted"))}
        {btn("video", "Camera", () => toast("Camera off"))}
        {btn("phone-off", "Leave call", () => { router.back(); toast("Call ended · 1 hour logged to the package"); }, true)}
      </View>
    </SafeAreaView>
  );
}
