import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { personTone } from "../../../components/adminSheets";
import { Av, Btn, Card, Chip, Grow, H, Hdr, KV, Row, RowV, Screen, Small, SS } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";
import { initials } from "../../../lib/sample";

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { s, change } = useDemo();
  const { toast, faceId } = useOverlay();
  const i = Number(id);
  const p = s.people[i];
  if (!p) return null;
  const [n, sub, st] = p;
  const suspended = st === "Suspended";
  const flip = () => faceId(() => {
    change((x) => { x.people[i][2] = suspended ? "Active" : "Suspended"; x.log.unshift(["Taylor Reed", suspended ? `Lifted suspension: ${n}` : `Suspended ${n}`, "Now"]); });
    toast(suspended ? "Suspension lifted" : `${n} is suspended`);
  });
  return (
    <Screen>
      <Hdr title={n} sub={sub} />
      <RowV gap={12}>
        <Av init={initials(n)} size={88} />
        <Grow gap={4}><H>{n}</H><SS>{sub}</SS><Chip label={st} tone={personTone(st)} /></Grow>
      </RowV>
      <Card>
        <KV k="Joined" v="Aug 14, 2026" />
        <KV k="Orders" v="4" />
        <KV k="Reviews" v="4.8 ★ (8)" />
        <KV k="Last signed in" v="Today" />
      </Card>
      <View>
        <Row tt="Orders" ss="4 orders" onPress={() => router.push("/admin/money")} />
        <Row tt="Messages" ss="View-only, for safety reviews" onPress={() => toast("Opens messages (example)")} last />
      </View>
      {suspended ? <Btn kind="line" label="Lift suspension" onPress={flip} /> : <Btn kind="red" label="Suspend account" onPress={flip} />}
      <Small>Suspending signs them out everywhere and hides a mentor’s profile. Face ID is needed first.</Small>
    </Screen>
  );
}
