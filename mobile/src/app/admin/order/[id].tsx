import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Btn, Card, Hdr, KV, Note, Row, Screen, StatusChip } from "../../../components/ui";
import { useDemo, useOverlay } from "../../../lib/demo";
import { money } from "../../../lib/sample";

export default function Order() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, change } = useDemo();
  const { toast, faceId } = useOverlay();
  const o = s.orders.find((x) => x.id === id);
  if (!o) return null;
  const act = (refund: boolean) => faceId(() => {
    change((n) => { n.orders.find((x) => x.id === id)!.st = refund ? "REFUNDED" : "RELEASED"; n.log.unshift(["Taylor Reed", `${refund ? "Refunded" : "Released"} ${o.what}`, "Now"]); });
    toast(refund ? `Refunded ${money(o.amt)} as MentorsMD credit` : "Released to the mentor");
  });
  return (
    <Screen>
      <Hdr title="Order" sub={o.what} />
      <Card>
        <KV k="Student → mentor" v={o.who} />
        <KV k="Paid" v={money(o.amt)} />
        <KV k="MentorsMD fee (30%)" v={money(o.amt * 0.3)} />
        <KV k="Mentor receives" v={money(o.amt * 0.7)} />
        <KV k="Status" v={<StatusChip status={o.st} />} />
      </Card>
      {["IN_ESCROW", "COMPLETED", "DISPUTE"].includes(o.st) ? <Btn kind="red" label="Refund student" onPress={() => act(true)} /> : null}
      {o.st === "COMPLETED" ? <Btn kind="line" label="Release to mentor now" onPress={() => act(false)} /> : null}
      {o.st === "PENDING_PAYMENT" ? <Note>The student started checkout but hasn’t paid. Unpaid checkouts close after 1 hour.</Note> : null}
      <View><Row tt="Hours log" ss="Every call and written hour" onPress={() => toast("Opens hours log (example)")} last /></View>
    </Screen>
  );
}
