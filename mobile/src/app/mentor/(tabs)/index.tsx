import { useRouter } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { Bar, Btn, Card, Chip, Eyebrow, Grow, Link, Loading, Note, Row, RowV, Screen, Sec, SecH, SS, Stat, Stats, StatusBadge, T, TT } from "../../../components/ui";
import { ErrorBox, openSite, payoutDayLabel, useReloadOnFocus } from "../../../components/mentorSheets";
import { dollars, useApi } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { PLATFORM_FEE_PERCENT } from "../../../lib/fee";
import { useColors } from "../../../lib/theme";
import { dayWord, firstName, fmtTime, minutesBetween } from "../../../lib/format";
import { finishPhase, hoursSummary, isLowOnHours, joinState, shortHours } from "../../../lib/orders";

type Nav = {
  mentor: {
    id: string; name: string; activePackages: number; listed: boolean; paused: boolean; removed: boolean; safetyHold: boolean; payoutsStarted: boolean;
    progress: { done: number; total: number; complete: boolean; missing: string[] };
  } | null;
};
type Pay = { unpaidCents: number; heldCents: number; nextPayoutDay: string; payoutsConnected: boolean };
type CalCall = { id: string; startTime: string; endTime: string; orderId: string | null; title: string; withName: string; kind: string };

const DAY = 24 * 3600_000;

// Mentor home, like the website's dashboard: finish your profile, needs your
// attention, this week's calls, active packages and earnings.
export default function MentorHome() {
  const router = useRouter();
  const c = useColors();
  const { user } = useAuth();
  const nav = useApi<Nav>("/api/me/nav");
  const pay = useApi<Pay>("/api/me/payouts");
  const pk = useApi<{ packages: any[] }>("/api/packages");
  const cal = useApi<{ upcoming: CalCall[] }>("/api/me/calendar");
  const convos = useApi<{ conversations: any[] }>("/api/conversations");
  const reloadAll = useCallback(() => {
    nav.reload(); pay.reload(); pk.reload(); cal.reload(); convos.reload();
  }, [nav.reload, pay.reload, pk.reload, cal.reload, convos.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnFocus(reloadAll);

  const m = nav.data?.mentor;
  const first = firstName(m?.name || user?.name);
  const loading = (nav.loading && !nav.data) || (pk.loading && !pk.data);
  const error = nav.error || pk.error || cal.error;

  const now = Date.now();
  const active = (pk.data?.packages || []).filter((p) => ["WORKING", "AWAITING_STUDENT", "DISPUTED"].includes(finishPhase(p)));
  const week = (cal.data?.upcoming || []).filter((x) => new Date(x.startTime).getTime() < now + 7 * DAY);

  // Needs your attention (same rules as the website).
  type Attn = { key: string; tt: string; ss?: string; go: () => void };
  const attn: Attn[] = [];
  if (m && !m.payoutsStarted) attn.push({ key: "payouts", tt: "Connect payouts", ss: "Students can't buy from you until your bank account is connected.", go: () => router.push("/mentor/payouts") });
  for (const cv of convos.data?.conversations || []) {
    const last = cv.messages?.[0];
    if (!last || last.senderId === user?.id || !(cv.sellerUnread > 0 || now - new Date(last.createdAt).getTime() < 7 * DAY)) continue;
    const hours = Math.max(1, Math.round((now - new Date(last.createdAt).getTime()) / 3600_000));
    attn.push({ key: `m${cv.id}`, tt: `Reply to ${firstName(cv.buyer?.name) || "your student"}`, ss: `Waiting ${hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`}`, go: () => router.push(`/mentor/chat/${cv.id}`) });
  }
  for (const p of active) {
    const who = firstName(p.buyer?.name) || "Student";
    const open = () => router.push(`/mentor/package/${p.id}`);
    if (p.disputed) attn.push({ key: `pd${p.id}`, tt: `${who} opened a dispute`, ss: p.title, go: open });
    else if (finishPhase(p) === "WORKING" && p.lastRequestNote && (p.lastCallUsedAt || p.lastRevisionUsedAt)) attn.push({ key: `pl${p.id}`, tt: `${who} asked for ${p.lastCallUsedAt ? "one last call" : "one last revision"}`, ss: p.title, go: open });
    else if (isLowOnHours(p)) attn.push({ key: `pw${p.id}`, tt: `${who} has ${shortHours(hoursSummary(p).left)} left`, ss: `Suggest a top-up or a final call · ${p.title}`, go: open });
  }

  const dot = <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} />;
  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Eyebrow>
        <T>Hi{first ? `, ${first}` : ""}</T>
      </View>
      {loading ? <Loading /> : error && !nav.data ? <ErrorBox error={error} onRetry={reloadAll} /> : (
        <>
          {error ? <ErrorBox error={error} onRetry={reloadAll} /> : null}
          <Stats>
            <Stat label="Earned this month (not yet paid)" value={pay.data ? dollars(pay.data.unpaidCents) : "…"} onPress={() => router.push("/mentor/payouts")} />
            <Stat label="Next payout" value={pay.data ? payoutDayLabel(pay.data.nextPayoutDay) : "…"} onPress={() => router.push("/mentor/payouts")} />
          </Stats>
          {pay.data && pay.data.heldCents > 0 ? <SS>+ {dollars(pay.data.heldCents)} held by a dispute</SS> : null}

          {m?.safetyHold ? (
            <Card tone="warn"><TT>Your profile is paused while our team reviews your account</TT><Note>Contact us if you have questions.</Note></Card>
          ) : m?.removed ? (
            <Card tone="warn"><TT>Your profile is removed</TT><Note>Your profile and packages are off the site. You can still finish active orders and get paid for them.</Note><Link label="Settings" onPress={() => router.push("/mentor/settings")} /></Card>
          ) : m?.paused ? (
            <Card tone="warn"><TT>Your profile is paused</TT><Note>Students won’t see you on Browse and can’t book you. Orders you already have keep going.</Note><Link label="Turn it back on" onPress={() => router.push("/mentor/settings")} /></Card>
          ) : null}

          {m && !m.progress.complete ? (
            <Card tone="tint" onPress={() => router.push("/mentor/profile")}>
              <SecH><TT>Finish your profile</TT><TT>{m.progress.done} of {m.progress.total}</TT></SecH>
              <Bar pct={(m.progress.done / Math.max(1, m.progress.total)) * 100} />
              <SS>Still to do: {m.progress.missing.join(" · ")}</SS>
              <Note>Your profile is hidden from Browse until it’s complete. Students can’t find you or buy from you yet.</Note>
            </Card>
          ) : null}

          <Sec>
            <SecH><Eyebrow>Needs your attention</Eyebrow>{attn.length ? <SS>{attn.length} {attn.length === 1 ? "thing" : "things"}</SS> : null}</SecH>
            {attn.length ? (
              <View>{attn.map((a, i) => <Row key={a.key} left={dot} tt={a.tt} ss={a.ss} onPress={a.go} last={i === attn.length - 1} />)}</View>
            ) : <Note>You’re all caught up.</Note>}
          </Sec>

          <Sec>
            <SecH><Eyebrow>This week’s calls</Eyebrow><Link label="Calendar" onPress={() => router.push("/mentor/calendar")} /></SecH>
            {cal.loading && !cal.data ? <Loading /> : week.length ? week.map((x) => {
              const open = joinState(x) === "open";
              return (
                <Card key={x.id} row>
                  <Grow>
                    <TT>{x.withName || "Student"} · {minutesBetween(x.startTime, x.endTime)} min</TT>
                    <SS>{dayWord(x.startTime)} · {fmtTime(x.startTime)} · {x.title}</SS>
                  </Grow>
                  {open ? <Btn kind="dark" sm label="Join" onPress={() => router.push(`/call/${x.id}`)} /> : null}
                </Card>
              );
            }) : <Note>No calls in the next 7 days.</Note>}
          </Sec>

          <Sec>
            <SecH><Eyebrow>Active students & packages</Eyebrow><Link label={active.length ? `All ${active.length}` : "All packages"} onPress={() => router.push("/mentor/students")} /></SecH>
            {active.length ? active.slice(0, 5).map((p) => {
              const h = hoursSummary(p);
              return (
                <Card key={p.id} onPress={() => router.push(`/mentor/package/${p.id}`)}>
                  <RowV style={{ justifyContent: "space-between" }}>
                    <Grow><TT>{p.buyer?.name}</TT><SS numberOfLines={1}>{p.title}</SS></Grow>
                    {finishPhase(p) !== "WORKING" ? <StatusBadge order={p} audience="mentor" /> : isLowOnHours(p) ? <Chip label="Running low" tone="warn" /> : null}
                  </RowV>
                  <Bar pct={h.purchased ? ((h.used + h.reserved) / h.purchased) * 100 : 0} />
                  <SS>{shortHours(h.left)} left of {shortHours(h.purchased)}{p.newMessages > 0 ? ` · ${p.newMessages} new message${p.newMessages === 1 ? "" : "s"}` : ""}</SS>
                </Card>
              );
            }) : <Note>No active packages right now.</Note>}
          </Sec>

          <Card tone="tint" onPress={() => openSite("/dashboard/offer-guide")}>
            <TT>Not Sure How To Structure Your Offers?</TT>
            <Note>Open the Offer Guide on mentorsmd.com. You earn {100 - PLATFORM_FEE_PERCENT}% of each hour, paid on the 24th of each month.</Note>
          </Card>
        </>
      )}
    </Screen>
  );
}
