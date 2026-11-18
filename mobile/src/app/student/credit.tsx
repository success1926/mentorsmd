import { useRouter } from "expo-router";
import { View } from "react-native";
import { LoadError, useRefresh } from "../../components/shared";
import { Btn, Eyebrow, Hdr, KV, Loading, Note, Screen, Sec, Small, Stat } from "../../components/ui";
import { dollars, useApi } from "../../lib/api";
import { fmtDayYear } from "../../lib/orders";
import { useColors } from "../../lib/theme";

type Entry = { id: string; amountCents: number; reason: string; note: string | null; createdAt: string; packageTitle: string | null };
// Same words as the website's credit page (CREDIT_REASON_LABEL).
const REASON: Record<string, string> = {
  DISPUTE_REFUND: "Refund as credit (dispute)",
  ADMIN_ADJUST: "Adjusted by the MentorsMD team",
  SPENT: "Used at checkout",
  SPENT_REVERSED: "Given back (checkout not completed)",
  GIFT: "Gift",
};

// MentorsMD credit (/api/me/credit): the balance and the last 20 entries.
export default function Credit() {
  const c = useColors();
  const router = useRouter();
  const q = useApi<{ balanceCents: number; entries: Entry[] }>("/api/me/credit");
  useRefresh(q.reload);
  const d = q.data;
  return (
    <Screen>
      <Hdr title="MentorsMD Credit" />
      {q.loading && !d ? <Loading /> : null}
      {q.error && !d ? <LoadError error={q.error} onRetry={q.reload} title="Couldn’t load your credit" /> : null}
      {d ? (
        <>
          <View style={{ flexDirection: "row" }}><Stat label="Your balance" value={dollars(d.balanceCents)} /></View>
          <Note>Used automatically at checkout, with any mentor. It never expires, and it can’t be cashed out.</Note>
          <Btn kind="line" label={d.balanceCents > 0 ? "Use it with a mentor" : "Find a mentor"} onPress={() => router.push("/student/find")} />
          <Sec>
            <Eyebrow>History</Eyebrow>
            {d.entries.length ? (
              <View>
                {d.entries.map((e) => (
                  <View key={e.id}>
                    <KV k={`${REASON[e.reason] || "Credit"}${e.packageTitle ? ` · ${e.packageTitle}` : ""}`} v={`${e.amountCents > 0 ? "+" : "−"}${dollars(Math.abs(e.amountCents))}`} vColor={e.amountCents > 0 ? c.okFg : undefined} kInk />
                    <Small>{fmtDayYear(e.createdAt)}{e.note && e.reason !== "SPENT" ? ` · ${e.note}` : ""}</Small>
                  </View>
                ))}
              </View>
            ) : <Note>No credit yet. If a package is refunded, the refund comes back to you as MentorsMD credit and shows here, and so does credit a parent or guardian gives you.</Note>}
          </Sec>
          <Small>Refunds on packages always come back as credit, never to the card.</Small>
        </>
      ) : null}
    </Screen>
  );
}
