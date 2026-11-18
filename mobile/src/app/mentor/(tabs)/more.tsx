import { useRouter } from "expo-router";
import { View } from "react-native";
import { Row, Screen, T } from "../../../components/ui";
import { openSite, useReloadOnFocus } from "../../../components/mentorSheets";
import { useApi } from "../../../lib/api";

type Nav = { mentor: { listed: boolean; paused: boolean; payoutsStarted: boolean; progress: { done: number; total: number; complete: boolean } } | null };

export default function MentorMore() {
  const router = useRouter();
  const nav = useApi<Nav>("/api/me/nav");
  useReloadOnFocus(nav.reload);
  const m = nav.data?.mentor;
  const profileSub = !m ? "Your public profile" : m.progress.complete ? (m.paused ? "Complete · paused" : m.listed ? "Complete · live on Browse" : "Complete") : `${m.progress.done} of ${m.progress.total} steps done`;
  return (
    <Screen>
      <T>More</T>
      <View>
        <Row tt="My profile" ss={profileSub} onPress={() => router.push("/mentor/profile")} />
        <Row tt="Rates & packages" ss="Your hourly rate, hour bundles and packages" onPress={() => router.push("/mentor/rates")} />
        <Row tt="Payouts" ss={m && !m.payoutsStarted ? "Connect your bank account to get paid" : "Earnings and monthly payouts"} onPress={() => router.push("/mentor/payouts")} />
        <Row tt="Settings" ss="Pause profile, students under 18, phones signed in" onPress={() => router.push("/mentor/settings")} />
        <Row tt="Offer Guide" ss="How to set up your offers · opens mentorsmd.com" onPress={() => openSite("/dashboard/offer-guide")} />
        <Row tt="Mentor Handbook" ss="How mentoring on MentorsMD works · opens mentorsmd.com" onPress={() => openSite("/dashboard/handbook")} last />
      </View>
    </Screen>
  );
}
