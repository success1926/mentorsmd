import { useRouter } from "expo-router";
import { View } from "react-native";
import { Chip, Hdr, Row, Screen, Small } from "../../components/ui";
import { useDemo } from "../../lib/demo";



export default function Applications() {
  const router = useRouter();
  const { s } = useDemo();
  return (
    <Screen>
      <Hdr title="Mentor Applications" />
      <View>{s.apps.map((x, i) => <Row key={x.id} tt={x.name} ss={`${x.stage} · ${x.school}`} rr={<Chip label={x.status} tone={x.status === "Invited" ? "ok" : x.status === "Declined" ? "bad" : "gray"} />} onPress={() => router.push(`/admin/application/${x.id}`)} last={i === s.apps.length - 1} />)}</View>
      <Small>Mentoring is by application only. Every applicant interviews with each senior team member before they’re invited.</Small>
    </Screen>
  );
}
