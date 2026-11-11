import { useRouter } from "expo-router";
import { View } from "react-native";
import { Row, Screen, T } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";

export default function Inbox() {
  const router = useRouter();
  const { s } = useDemo();
  return (
    <Screen>
      <T>Inbox</T>
      <View>
        <Row tt="Mentor applications" ss={`${s.apps.filter((a) => a.status === "New" || a.status === "Interviewing").length} waiting`} onPress={() => router.push("/admin/applications")} />
        <Row tt="Disputes & flags" ss={`${s.disputes.filter((d) => d.status === "Open").length} open dispute · 1 flag`} onPress={() => router.push("/admin/disputes")} />
        <Row tt="Leads" ss={`${s.leads.length} new this week`} onPress={() => router.push("/admin/leads")} last />
      </View>
    </Screen>
  );
}
