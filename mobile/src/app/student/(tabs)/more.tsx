import { useRouter } from "expo-router";
import { View } from "react-native";
import { Card, Note, Row, Screen, T, TT } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";
import { money } from "../../../lib/sample";

export default function More() {
  const router = useRouter();
  const { s } = useDemo();
  const { toast } = useOverlay();
  return (
    <Screen>
      <T>More</T>
      <View>
        <Row tt="Calendar" ss="Upcoming and past calls" onPress={() => router.push("/student/calendar")} />
        <Row tt="MentorsMD credit" ss={`${money(s.credit)} to spend`} onPress={() => router.push("/student/credit")} />
        <Row tt="Receipts" ss="3 payments" onPress={() => router.push("/student/receipts")} />
        <Row tt="Reviews" ss="4.9 from 74 students · where they got in" onPress={() => router.push("/reviews")} />
        <Row tt="Cycle results" ss="Share where you were accepted" onPress={() => router.push("/student/results")} />
        <Row tt="About you" ss="Helps mentors prepare" onPress={() => router.push("/student/about-you")} />
        <Row tt="Settings" ss="Sign-in, devices, notifications, delete account" onPress={() => router.push("/student/settings")} />
        <Row tt="Safety and help" ss="Community guidelines, report a problem" onPress={() => toast("Opens Safety (example)")} last />
      </View>
      <Card tone="tint"><TT>Gifts are bought on the website</TT><Note>Give MentorsMD hours to someone at mentorsmd.com/gift. Gifts you receive show up here as credit.</Note></Card>
    </Screen>
  );
}
