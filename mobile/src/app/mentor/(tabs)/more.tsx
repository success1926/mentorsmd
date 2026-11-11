import { useRouter } from "expo-router";
import { View } from "react-native";
import { GuideSheet } from "../../../components/shared";
import { Row, Screen, T } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";
import { money } from "../../../lib/sample";

export default function MentorMore() {
  const router = useRouter();
  const { s } = useDemo();
  const { openSheet } = useOverlay();
  return (
    <Screen>
      <T>More</T>
      <View>
        <Row tt="My profile" ss="85% complete · preview as students see it" onPress={() => router.push("/mentor/profile")} />
        <Row tt="Rates & packages" ss={`${money(s.rate)}/hr · ${s.bundles.length} bundles · 2 packages`} onPress={() => router.push("/mentor/rates")} />
        <Row tt="Payouts" ss={`Next payout ${s.pay.next}`} onPress={() => router.push("/mentor/payouts")} />
        <Row tt="Settings" ss="Pause profile, under-18 students, devices" onPress={() => router.push("/mentor/settings")} />
        <Row tt="Offer guide" ss="Example packages and freelancing notes" onPress={() => openSheet(GuideSheet)} last />
      </View>
    </Screen>
  );
}
