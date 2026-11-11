import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { Bubble, Composer, FChip, Hdr, RowV, Screen } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";
import { first, sampleMentor } from "../../../lib/sample";

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { s, change } = useDemo();
  const m = sampleMentor(id);
  if (!m) return null;
  const t = s.threads[id] || [];
  return (
    <Screen
      footer={
        <>
          <RowV gap={8}>
            <FChip label="Book free intro call" onPress={() => router.push(`/student/book?m=${id}&kind=intro`)} />
            <FChip label="See packages" onPress={() => router.push(`/profile/${id}`)} />
          </RowV>
          <Composer placeholder={`Message ${first(m.name)}`} onSend={(x) => change((n) => { n.threads[id] = [...(n.threads[id] || []), ["me", x]]; })} />
        </>
      }>
      <Hdr title={m.name} sub={m.reply} />
      <View style={{ gap: 8 }}>
        {t.length ? t.map(([w, x], i) => <Bubble key={i} who={w}>{x}</Bubble>) : <Bubble who="sys">Say hi. Messaging is free, and you can ask anything before you buy.</Bubble>}
      </View>
    </Screen>
  );
}
