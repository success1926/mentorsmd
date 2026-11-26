import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Btn, Card, Hdr, KV, LoadError, Loading, Screen, Small } from "../../../components/ui";
import { dollars, SITE, useApi } from "../../../lib/api";
import { hoursLabel, pkgTitle, type Pkg } from "../../../lib/orders";
import { fmtDay } from "../../../lib/format";

// One receipt: an order (/api/orders/[id]), or one of its "Add hours"
// payments (?t=<topUpId>).
export default function Receipt() {
  const { id, t } = useLocalSearchParams<{ id: string; t?: string }>();
  const q = useApi<{ order: Pkg }>(`/api/orders/${encodeURIComponent(id)}`);
  const o = q.data?.order;
  if (!o)
    return (
      <Screen>
        <Hdr title="Receipt" />
        {q.loading ? <Loading /> : q.error ? <LoadError error={q.error} onRetry={q.reload} title="Couldn’t load this receipt" /> : null}
      </Screen>
    );
  const top = t ? (o.topUps || []).find((x) => x.id === t) : undefined;
  const total = top ? top.amountCents || 0 : o.amount;
  const credit = top ? top.creditAppliedCents || 0 : o.creditAppliedCents;
  const refunded = !top ? o.refundedCreditCents || 0 : 0;
  const receiptId = top ? `t_${top.id}` : `o_${o.id}`;
  return (
    <Screen>
      <Hdr title="Receipt" sub={fmtDay(top ? top.paidAt : o.paidAt || o.createdAt)} />
      <Card>
        <KV k={top ? `${hoursLabel(top.minutes)} more: ${pkgTitle(o)}` : pkgTitle(o)} v={dollars(total)} />
        <KV k="Mentor" v={o.seller?.name || ""} />
        {!top && o.rateCents ? <KV k="Hours" v={`${hoursLabel(o.minutesPurchased - (o.topUps || []).reduce((s, x) => s + x.minutes, 0))} at ${dollars(o.rateCents)}/hr`} /> : null}
        {credit ? <KV k="MentorsMD credit" v={`−${dollars(credit)}`} /> : null}
        <KV k="Paid by card" v={dollars(Math.max(0, total - credit))} total />
        {refunded ? <KV k="Refunded as MentorsMD credit" v={dollars(refunded)} /> : null}
        {o.status === "REFUNDED" && !refunded ? <KV k="Status" v="Refunded" /> : null}
      </Card>
      <Btn kind="line" label="Open the full receipt on mentorsmd.com" onPress={() => WebBrowser.openBrowserAsync(`${SITE}/receipts/${receiptId}`)} />
      <Small>MentorsMD, not the mentor, took this payment. Packages are refunded as MentorsMD credit, never to the card.</Small>
    </Screen>
  );
}
