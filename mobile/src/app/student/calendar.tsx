import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { CallCard, LoadError, MoveSheet, useRefresh, type CalCall } from "../../components/shared";
import { Card, Chip, Eyebrow, Grow, Hdr, Link, Loading, Note, Row, Screen, Sec, SS, TT } from "../../components/ui";
import { SITE, useApi } from "../../lib/api";
import { useOverlay } from "../../lib/overlay";
import { callMinutes } from "../../lib/orders";
import { fmtDay, fmtTime } from "../../lib/format";

type Cal = { upcoming: CalCall[]; past: CalCall[]; feedConnected: boolean };

// Calendar (/api/me/calendar): upcoming calls (Join when open, move or
// cancel), and calls from the last 60 days.
export default function Calendar() {
  const { openSheet } = useOverlay();
  const q = useApi<Cal>("/api/me/calendar");
  useRefresh(q.reload, 60_000);
  const d = q.data;
  return (
    <Screen>
      <Hdr title="Calendar" />
      {q.loading && !d ? <Loading /> : null}
      {q.error && !d ? <LoadError error={q.error} onRetry={q.reload} title="Couldn’t load your calendar" /> : null}
      {d ? (
        <>
          <Sec>
            <Eyebrow>Upcoming</Eyebrow>
            {d.upcoming.length ? d.upcoming.map((x) => (
              <CallCard key={x.id} call={x} onMove={x.disputed ? undefined : () => openSheet(() => <MoveSheet call={x} onChanged={q.reload} />)} />
            )) : <Note>No calls booked. Book one from a package, or a free intro call from a mentor’s profile.</Note>}
          </Sec>
          <Sec>
            <Eyebrow>Past calls</Eyebrow>
            {d.past.length ? (
              <View>
                {d.past.map((x, i) => (
                  <Row key={x.id} tt={`${x.withName} · ${x.kind === "INTRO" ? "Free intro call" : x.title}`} ss={`${fmtDay(x.startTime)} · ${fmtTime(x.startTime)} · ${callMinutes(x)} min`} chevron={false} last={i === d.past.length - 1} />
                ))}
              </View>
            ) : <Note>No calls in the last 60 days.</Note>}
          </Sec>
          <Card tone="tint" row>
            <Grow>
              <TT>Calendar sync</TT>
              <SS>{d.feedConnected ? "Your MentorsMD calls show in your own calendar." : "Add your MentorsMD calls to Apple or Google Calendar."}</SS>
              {!d.feedConnected ? <Link label="Set it up on mentorsmd.com" onPress={() => WebBrowser.openBrowserAsync(`${SITE}/account`)} /> : null}
            </Grow>
            {d.feedConnected ? <Chip label="On" tone="ok" /> : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
