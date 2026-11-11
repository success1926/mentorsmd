import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { personTone } from "../../../components/adminSheets";
import { Chip, Row, Screen, Search, T } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";

export default function People() {
  const router = useRouter();
  const { s } = useDemo();
  const [q, setQ] = useState("");
  const list = s.people.map((p, i) => [p, i] as const).filter(([p]) => !q || (p[0] + p[1]).toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen>
      <T>Everyone</T>
      <Search value={q} onChange={setQ} placeholder="Search people" />
      <View>
        {list.map(([[n, sub, st], i]) => <Row key={n} tt={n} ss={sub} rr={<Chip label={st} tone={personTone(st)} />} onPress={() => router.push(`/admin/person/${i}`)} />)}
        <Row tt="Under 18" ss={`${s.minors.length} students`} onPress={() => router.push("/admin/minors")} last />
      </View>
    </Screen>
  );
}
