import { View } from "react-native";
import { Card, Chip, Eyebrow, Grow, Hdr, KV, Link, Note, Screen, Sec, SS, Stat, Stats, TT } from "../../components/ui";
import { useDemo, useOverlay } from "../../lib/demo";
import { money } from "../../lib/sample";

export default function Payouts() {
  const { s } = useDemo();
  const { toast } = useOverlay();
  return (
    <Screen>
      <Hdr title="Payouts" />
      <Stats><Stat label="Earned, not yet paid" value={money(s.pay.pending)} /><Stat label="Paid to you" value={money(s.pay.paid)} /></Stats>
      <Note>Students pay MentorsMD for hours at your rate. When a student approves a package (or 48 hours pass), your share is added to the next payout.</Note>
      <Card row><Grow><TT>Bank account</TT><SS>Chase •••• 6789 · connected through Stripe</SS></Grow><Chip label="Ready" tone="ok" /></Card>
      <Sec>
        <Eyebrow>History</Eyebrow>
        <View>
          <KV k="Nov 24 (next)" v={money(s.pay.pending)} kInk />
          <KV k="Oct 24" v="$2,184" kInk />
          <KV k="Sep 24" v="$2,184" kInk />
        </View>
      </Sec>
      <Link label="Manage bank details on Stripe" onPress={() => toast("Opens Stripe in the browser (example)")} />
    </Screen>
  );
}
