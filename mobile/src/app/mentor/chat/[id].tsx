import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Bubble, Card, Composer, Hdr, Note, Screen } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";
import { first, MENTOR_STUDENT_NAMES } from "../../../lib/sample";

export default function MentorChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, change } = useDemo();
  const name = MENTOR_STUDENT_NAMES[id] || "Student";
  const t = s.mThreads[id] || [];
  return (
    <Screen
      footer={
        <>
          {id === "jordan" ? <Card tone="tint" style={{ padding: 12 }}><Note>Tip: offer a free 15-minute intro call, or point Sofia to your Secondaries bundle.</Note></Card> : null}
          <Composer placeholder={`Message ${first(name)}`} onSend={(x) => change((n) => { n.mThreads[id] = [...(n.mThreads[id] || []), ["me", x]]; })} />
        </>
      }>
      <Hdr title={name} sub={id === "jordan" ? "New student · Reapplicant" : "Student"} />
      <View style={{ gap: 8 }}>{t.length ? t.map(([w, x], i) => <Bubble key={i} who={w}>{x}</Bubble>) : <Bubble who="sys">No messages yet.</Bubble>}</View>
    </Screen>
  );
}
