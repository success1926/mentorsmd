import { useRouter } from "expo-router";
import { useState } from "react";
import { Av, Bar, Card, Chip, FChip, FChipRow, Grow, Loading, Note, RowV, Screen, SS, StatusBadge, T, TT } from "../../../components/ui";
import { ErrorBox, useReloadOnFocus } from "../../../components/mentorSheets";
import { useApi } from "../../../lib/api";
import { finishPhase, hoursSummary, isLowOnHours, shortHours } from "../../../lib/orders";
import { initialsOf } from "../../../lib/format";

type Filter = "active" | "waiting" | "done";
const FILTERS: [Filter, string][] = [["active", "Active"], ["waiting", "Waiting on student"], ["done", "Completed"]];

function inFilter(p: any, f: Filter) {
  const phase = finishPhase(p);
  if (f === "waiting") return phase === "AWAITING_STUDENT";
  if (f === "active") return phase === "WORKING" || phase === "AWAITING_STUDENT" || phase === "DISPUTED";
  return phase === "APPROVED" || phase === "CLOSED";
}

// Students & packages: every hours package students bought from the mentor
// (/api/packages).
export default function Students() {
  const router = useRouter();
  const pk = useApi<{ packages: any[] }>("/api/packages");
  const [filter, setFilter] = useState<Filter>("active");
  const reload = pk.reload;
  useReloadOnFocus(reload);

  const list = pk.data?.packages || [];
  const shown = list.filter((p) => inFilter(p, filter));
  const count = (f: Filter) => list.filter((p) => inFilter(p, f)).length;

  return (
    <Screen>
      <T>Students & Packages</T>
      <Note>Every package students have bought from you, with the hours used and left.</Note>
      {pk.loading && !pk.data ? <Loading /> : pk.error && !pk.data ? <ErrorBox error={pk.error} onRetry={reload} /> : (
        <>
          <FChipRow>{FILTERS.map(([k, l]) => <FChip key={k} label={`${l} ${count(k)}`} on={filter === k} onPress={() => setFilter(k)} />)}</FChipRow>
          {!shown.length ? (
            <Note>{filter === "active" ? "No active packages right now. When a student buys hours or a package from you, it shows up here." : filter === "waiting" ? "Nothing is waiting on a student." : "No completed packages yet."}</Note>
          ) : shown.map((p) => {
            const h = hoursSummary(p);
            return (
              <Card key={p.id} onPress={() => router.push(`/mentor/package/${p.id}`)}>
                <RowV>
                  <Av init={initialsOf(p.buyer?.name)} photo={p.buyer?.photoUrl} size={36} />
                  <Grow>
                    <RowV gap={6}><TT>{p.buyer?.name}</TT>{p.buyer?.minorStatus ? <Chip label="Under 18" tone="gray" /> : null}</RowV>
                    <SS numberOfLines={1}>{p.title}</SS>
                  </Grow>
                  {isLowOnHours(p) ? <Chip label="Running low" tone="warn" /> : <StatusBadge order={p} audience="mentor" />}
                </RowV>
                <Bar pct={h.purchased ? ((h.used + h.reserved) / h.purchased) * 100 : 0} />
                <SS>
                  {shortHours(h.used)} used · {shortHours(h.left)} left of {shortHours(h.purchased)} · {h.callsHeld} call{h.callsHeld === 1 ? "" : "s"} held
                  {p.newMessages > 0 ? ` · ${p.newMessages} new message${p.newMessages === 1 ? "" : "s"}` : ""}
                </SS>
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
