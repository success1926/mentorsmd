import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { CallCard, MentorCard, MoveSheet, PkgCard, useCallbackAll, useRefresh, type CalCall } from "../../../components/shared";
import { Av, Btn, Card, Eyebrow, Grow, Link, LoadError, Loading, Note, RowV, Screen, Sec, SecH, SS, T, TT } from "../../../components/ui";
import { dollars, useApi } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useOverlay } from "../../../lib/overlay";
import { searchLive, useLoad } from "../../../lib/live";
import { finishPhase, hoursSummary, hoursToRespond, isActive, LOW_HOURS_MINUTES, pkgTitle, shortHours, type Pkg } from "../../../lib/orders";
import { useColors } from "../../../lib/theme";
import { firstName, initialsOf } from "../../../lib/format";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

type Nav = { unread: number; student: { name: string; photoUrl: string | null; activePackages: number; waiting: number; upcomingCalls: number; creditCents: number; profileFilled: boolean } | null };

// Home (the website's student dashboard): what needs you, coming-up calls,
// active packages, MentorsMD credit and a few mentors.
export default function StudentHome() {
  const router = useRouter();
  const c = useColors();
  const { user } = useAuth();
  const { openSheet } = useOverlay();
  const nav = useApi<Nav>("/api/me/nav");
  const pk = useApi<{ packages: Pkg[] }>("/api/packages");
  const cal = useApi<{ upcoming: CalCall[] }>("/api/me/calendar");
  const mentors = useLoad(() => searchLive({}), []);
  const { reload: r1 } = nav;
  const { reload: r2 } = pk;
  const { reload: r3 } = cal;
  useRefresh(useCallbackAll(r1, r2, r3));

  const me = nav.data?.student;
  const name = me?.name || user?.name || "";
  const all = pk.data?.packages || [];
  const active = all.filter(isActive);
  const calls = (cal.data?.upcoming || []).slice(0, 3);

  // What's next, in the website's order.
  const next: { key: string; title: string; sub: string; action: ReactNode }[] = [];
  for (const p of active.filter((p) => finishPhase(p) === "AWAITING_STUDENT"))
    next.push({ key: "done" + p.id, title: `${p.seller?.name} marked ${pkgTitle(p)} complete`, sub: `Respond in ${hoursToRespond(p)} h, or it’s approved automatically.`, action: <Btn sm label="Review and approve" onPress={() => router.push(`/student/package/${p.id}`)} /> });
  for (const p of active.filter((p) => finishPhase(p) === "DISPUTED"))
    next.push({ key: "disp" + p.id, title: `Your dispute on ${pkgTitle(p)} is open`, sub: "The MentorsMD team is reviewing it. You can add details on the package page.", action: <Btn sm kind="line" label="View" onPress={() => router.push(`/student/package/${p.id}`)} /> });
  for (const p of active.filter((p) => (p.newMessages || 0) > 0 && !!p.conversationId))
    next.push({ key: "msg" + p.id, title: `${p.seller?.name} replied`, sub: `${p.newMessages} new message${p.newMessages === 1 ? "" : "s"} · ${pkgTitle(p)}`, action: <Btn sm kind="line" label="Read" onPress={() => router.push(`/student/chat/${p.conversationId}`)} /> });
  for (const p of active.filter((p) => finishPhase(p) === "WORKING" && p.minutesPurchased > LOW_HOURS_MINUTES && hoursSummary(p).left <= LOW_HOURS_MINUTES))
    next.push({ key: "low" + p.id, title: `${shortHours(hoursSummary(p).left)} left on ${pkgTitle(p)}`, sub: `with ${p.seller?.name} · booked calls count as used`, action: <Btn sm kind="line" label="Add hours" onPress={() => router.push(`/student/package/${p.id}`)} /> });
  if (me && !me.profileFilled)
    next.push({ key: "about", title: "Tell mentors a bit about you", sub: "When you apply, your stage and what you want help with. 1 minute, only your mentors see it.", action: <Btn sm kind="line" label="Add" onPress={() => router.push("/student/about-you")} /> });

  const firstLoad = (nav.loading && !nav.data) || (pk.loading && !pk.data);
  return (
    <Screen>
      <RowV style={{ justifyContent: "space-between" }}>
        <View style={{ gap: 4, flex: 1 }}><Eyebrow>{greeting()}</Eyebrow><T>Hi{name ? `, ${firstName(name)}` : ""}</T></View>
        <Av init={initialsOf(name)} photo={me?.photoUrl} onPress={() => router.push("/student/settings")} />
      </RowV>

      {firstLoad ? <Loading /> : null}
      {nav.error && !nav.data ? <LoadError error={nav.error} onRetry={nav.reload} /> : null}
      {pk.error && !pk.data ? <LoadError error={pk.error} onRetry={pk.reload} title="Couldn’t load your packages" /> : null}

      {pk.data ? (
        next.length ? (
          <Sec>
            <Eyebrow>What’s next</Eyebrow>
            {next.map((n) => (
              <Card key={n.key} tone="tint">
                <TT>{n.title}</TT>
                <Note>{n.sub}</Note>
                {n.action}
              </Card>
            ))}
          </Sec>
        ) : (
          <Card tone="tint"><Eyebrow>What’s next</Eyebrow><Note>All caught up. Nothing is waiting for you.</Note></Card>
        )
      ) : null}

      <Sec>
        <SecH><Eyebrow>Coming up</Eyebrow><Link label="Calendar" onPress={() => router.push("/student/calendar")} /></SecH>
        {cal.loading && !cal.data ? <Loading /> : cal.error && !cal.data ? <LoadError error={cal.error} onRetry={cal.reload} title="Couldn’t load your calls" /> : calls.length ? (
          calls.map((x) => <CallCard key={x.id} call={x} onMove={() => openSheet(() => <MoveSheet call={x} onChanged={cal.reload} />)} />)
        ) : (
          <Note>No calls booked. Book one from a package, or a free intro call from a mentor’s profile.</Note>
        )}
      </Sec>

      {pk.data ? (
        <Sec>
          <SecH><Eyebrow>Your packages</Eyebrow>{all.length ? <Link label="See all" onPress={() => router.push("/student/packages")} /> : null}</SecH>
          {active.length ? active.slice(0, 3).map((p) => <PkgCard key={p.id} p={p} />) : (
            <Card>
              <TT>{all.length ? "No active packages" : "Find your first mentor"}</TT>
              <Note>Message any mentor for free, or book a free 15-minute intro call.</Note>
              <Btn kind="line" sm label="Find a mentor" onPress={() => router.push("/student/find")} />
            </Card>
          )}
        </Sec>
      ) : null}

      {me ? (
        <Card row onPress={() => router.push("/student/credit")}>
          <Grow><TT>MentorsMD credit</TT><SS>Used first at checkout</SS></Grow>
          <TT style={{ color: c.link }}>{dollars(me.creditCents)}</TT>
        </Card>
      ) : null}

      {mentors.data?.mentors.length ? (
        <Sec>
          <SecH><Eyebrow>Mentors for you</Eyebrow><Link label="Find a mentor" onPress={() => router.push("/student/find")} /></SecH>
          {mentors.data.mentors.slice(0, 2).map((m) => <MentorCard key={m.id} m={m} />)}
        </Sec>
      ) : null}
    </Screen>
  );
}
