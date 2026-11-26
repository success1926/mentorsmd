import { useRouter } from "expo-router";
import { View } from "react-native";
import { useCallbackAll, useRefresh } from "../../components/shared";
import { Hdr, LoadError, Loading, Note, Row, Screen, Small } from "../../components/ui";
import { dollars, useApi } from "../../lib/api";
import { hoursLabel, pkgTitle, priceFor, type Pkg } from "../../lib/orders";
import { fmtDay } from "../../lib/format";

type OrderRow = { id: string; status: string; amount: number; creditAppliedCents: number; createdAt: string; paidAt: string | null; packageTitle: string | null; gig: { title: string } | null; seller: { name: string } };
type Line = { key: string; href: string; title: string; sub: string; cents: number; at: number };

// Receipts: every payment, newest first. Orders come from /api/orders;
// "Add hours" payments from each package's paid top-ups (/api/packages).
export default function Receipts() {
  const router = useRouter();
  const orders = useApi<{ orders: OrderRow[] }>("/api/orders");
  const pk = useApi<{ packages: Pkg[] }>("/api/packages");
  useRefresh(useCallbackAll(orders.reload, pk.reload));
  const lines: Line[] = [];
  for (const o of orders.data?.orders || []) {
    if (o.status === "PENDING_PAYMENT" || o.status === "CANCELLED") continue;
    const at = o.paidAt || o.createdAt;
    lines.push({ key: "o" + o.id, href: `/student/receipt/${o.id}`, title: pkgTitle(o), sub: `${o.seller.name} · ${fmtDay(at)}${o.status === "REFUNDED" ? " · Refunded" : ""}`, cents: o.amount, at: new Date(at).getTime() });
  }
  for (const p of pk.data?.packages || [])
    for (const t of p.topUps || [])
      lines.push({ key: "t" + t.id, href: `/student/receipt/${p.id}?t=${t.id}`, title: `${hoursLabel(t.minutes)} more: ${pkgTitle(p)}`, sub: `${p.seller?.name} · ${fmtDay(t.paidAt)}`, cents: priceFor(t.minutes, p.rateCents || 0), at: new Date(t.paidAt || 0).getTime() });
  lines.sort((a, b) => b.at - a.at);
  const loading = (orders.loading && !orders.data) || (pk.loading && !pk.data);
  const error = (!orders.data && orders.error) || (!pk.data && pk.error);
  return (
    <Screen>
      <Hdr title="Receipts" />
      {loading ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => { orders.reload(); pk.reload(); }} title="Couldn’t load your receipts" /> : null}
      {!loading && !error && !lines.length ? <Note>No payments yet. Receipts for packages, hours and calls you buy show here.</Note> : null}
      {lines.length ? (
        <View>
          {lines.map((l, i) => <Row key={l.key} tt={l.title} ss={l.sub} rr={dollars(l.cents)} onPress={() => router.push(l.href)} last={i === lines.length - 1} />)}
        </View>
      ) : null}
      {lines.length ? <Small>Packages are refunded as MentorsMD credit, never to the card.</Small> : null}
    </Screen>
  );
}
