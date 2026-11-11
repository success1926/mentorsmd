import { useRouter } from "expo-router";
import { View } from "react-native";
import { Card, Note, Row, Screen, T, TT } from "../../../components/ui";

export default function AdminMore() {
  const router = useRouter();
  return (
    <Screen>
      <T>More</T>
      <View>
        <Row tt="Action log" ss="View only · who did what" onPress={() => router.push("/admin/log")} />
        <Row tt="Calls & recordings" onPress={() => router.push("/admin/calls")} />
        <Row tt="Settings" ss="Alerts, Face ID, devices" onPress={() => router.push("/admin/settings")} last />
      </View>
      <Card tone="tint"><TT>On the website only</TT><Note>Website pages, emails, outbox, legal, services, team and roles, insights and analytics stay on mentorsmd.com/admin.</Note></Card>
    </Screen>
  );
}
