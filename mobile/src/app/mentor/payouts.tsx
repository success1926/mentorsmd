import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { Btn, Card, Chip, Collapsible, Grow, Hdr, KV, Link, LoadError, Loading, Note, Screen, Small, SS, Stat, Stats, TT } from "../../components/ui";
import { ErrText, PAYOUT_STATUS_LABEL, payoutDayLabel, periodLabel, useReloadOnFocus } from "../../components/mentorSheets";
import { api, dollars, errorText, SITE, useApi } from "../../lib/api";
import { useColors } from "../../lib/theme";
import { PLATFORM_FEE_PERCENT } from "../../lib/fee";
import { fmtDay } from "../../lib/format";
import { shortHours } from "../../lib/orders";

type Pay = { unpaidCents: number; unpaidMinutes: number; heldCents: number; nextPayoutDay: string; payoutsConnected: boolean; past: { id: string; period: string; amountCents: number; minutes: number; status: string; paidAt: string | null }[] };
type Stripe = { connected: boolean; started: boolean; outstandingItems?: string[]; error?: string };

// Turns Stripe requirement ids like "individual.verification.document" into words.
const readable = (item: string) => item.replace(/[._]/g, " ").replace(/\bdob\b/i, "date of birth").replace(/\bssn last 4\b/i, "last 4 of SSN").replace(/^\w/, (ch) => ch.toUpperCase());

// Payouts: earnings (/api/me/payouts), the bank account's status with Stripe
// (/api/stripe/status) and setting it up. "Connect bank account" asks the
// website for a Stripe setup link (/api/stripe/connect) and opens it in the
// in-app browser; Stripe collects the bank details, tax info and ID.
export default function Payouts() {
  const c = useColors();
  const pay = useApi<Pay>("/api/me/payouts");
  const st = useApi<Stripe>("/api/stripe/status");
  useReloadOnFocus(() => { pay.reload(); st.reload(); });
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setOpening(true);
    setError(null);
    try {
      const r = await api<{ url?: string; error?: string }>("/api/stripe/connect", { method: "POST" });
      if (!r.url) throw new Error(r.error || "Stripe didn't return a link. Try again in a minute.");
      await WebBrowser.openBrowserAsync(r.url);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setOpening(false);
      st.reload();
    }
  };

  const p = pay.data;
  const s = st.data;
  const paid = (p?.past || []).filter((x) => x.status === "PAID");
  return (
    <Screen>
      <Hdr title="Payouts" />
      <Note>Paid monthly, on the 24th, for every hour you work. You keep {100 - PLATFORM_FEE_PERCENT}%; MentorsMD keeps {PLATFORM_FEE_PERCENT}%.</Note>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Grow><TT>Bank account</TT></Grow>
          {s ? <Chip label={s.connected ? "Connected" : s.started ? "Setup not finished" : "Not connected"} tone={s.connected ? "ok" : "warn"} /> : null}
        </View>
        {st.loading && !s ? <SS>Checking status…</SS> : st.error && !s ? <LoadError error={st.error} onRetry={st.reload} /> : s?.connected ? (
          <Note>You’re set. Your monthly payout goes to your bank automatically on the 24th.</Note>
        ) : s ? (
          <>
            <Note>{s.started ? "You started setup, but Stripe still needs a bit more before you can be paid." : "Connect a bank account to get paid. Stripe collects your bank details, tax info and ID directly. None of it is stored on MentorsMD."}</Note>
            {s.outstandingItems?.length ? (
              <Card tone="warn" style={{ padding: 12 }}>
                <TT style={{ color: c.warnFg }}>Stripe still needs:</TT>
                {s.outstandingItems.map((it, i) => <Note key={i} style={{ color: c.warnFg }}>• {readable(it)}</Note>)}
              </Card>
            ) : null}
            <Btn kind="dark" label={opening ? "Opening Stripe…" : s.started ? "Finish setup" : "Connect bank account"} disabled={opening} onPress={connect} />
          </>
        ) : null}
        <ErrText>{error}</ErrText>
        <Link label="Refresh status" onPress={st.reload} />
      </Card>

      {pay.loading && !p ? <Loading /> : !p ? <LoadError error={pay.error || "Couldn’t load your earnings"} onRetry={pay.reload} /> : (
        <>
          <Stats>
            <Stat label="Earned, not yet paid" value={dollars(p.unpaidCents)} />
            <Stat label="Paid to you" value={dollars(paid.reduce((a, x) => a + x.amountCents, 0))} />
          </Stats>
          <SS>Next payout: {payoutDayLabel(p.nextPayoutDay)}{p.heldCents > 0 ? ` · ${dollars(p.heldCents)} held by a dispute` : ""} · {paid.length} monthly payout{paid.length === 1 ? "" : "s"} so far, after the {PLATFORM_FEE_PERCENT}% fee</SS>

          <Card tone="tint">
            <TT>How payouts work</TT>
            <Note ink>1. Students pay MentorsMD for hours at your rate.</Note>
            <Note ink>2. Each call held and each block of written work you log is added to your earnings ({100 - PLATFORM_FEE_PERCENT}% of the hour).</Note>
            <Note ink>3. When a package is approved (by the student, or automatically after 48 hours), its unused hours are added too.</Note>
            <Note ink>4. On the 24th of each month, everything not yet paid goes to your bank in one Stripe payout. Hours on a package with an open dispute wait until it’s decided.</Note>
          </Card>

          {p.past.length ? (
            <Collapsible title="Payout history" count={p.past.length} defaultOpen>
              <View>
                {p.past.map((x) => (
                  <KV key={x.id} kInk line k={`${periodLabel(x.period)} · ${shortHours(x.minutes)}`}
                    v={`${dollars(x.amountCents)} · ${x.paidAt ? fmtDay(x.paidAt) : x.status === "FAILED" ? "Delayed, we’re on it" : PAYOUT_STATUS_LABEL[x.status] || x.status}`} />
                ))}
              </View>
            </Collapsible>
          ) : null}
        </>
      )}
      <Link label="Open Payouts on mentorsmd.com" onPress={() => WebBrowser.openBrowserAsync(SITE + "/dashboard/payouts")} />
      <Small>Bank details are managed on Stripe.</Small>
    </Screen>
  );
}
