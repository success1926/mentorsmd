import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { useRefresh } from "../../../components/shared";
import { Card, Note, Row, Screen, T, TT } from "../../../components/ui";
import { dollars, SITE, useApi } from "../../../lib/api";

export default function More() {
  const router = useRouter();
  const credit = useApi<{ balanceCents: number }>("/api/me/credit");
  useRefresh(credit.reload);
  return (
    <Screen>
      <T>More</T>
      <View>
        <Row tt="Calendar" ss="Upcoming and past calls" onPress={() => router.push("/student/calendar")} />
        <Row tt="MentorsMD credit" ss={credit.data ? `${dollars(credit.data.balanceCents)} to spend` : "Used first at checkout"} onPress={() => router.push("/student/credit")} />
        <Row tt="Receipts" ss="Everything you’ve paid for" onPress={() => router.push("/student/receipts")} />
        <Row tt="Cycle results" ss="Share where you were accepted" onPress={() => router.push("/student/results")} />
        <Row tt="About you" ss="Helps mentors prepare" onPress={() => router.push("/student/about-you")} />
        <Row tt="Settings" ss="Sign-in, phones signed in, delete account" onPress={() => router.push("/student/settings")} />
        <Row tt="Safety and help" ss="Community guidelines, contact us" onPress={() => WebBrowser.openBrowserAsync(`${SITE}/contact`)} last />
      </View>
      <Card tone="tint"><TT>Gifts are bought on the website</TT><Note>Give MentorsMD hours at mentorsmd.com/gift. Gifts you receive show up here as credit.</Note></Card>
    </Screen>
  );
}
