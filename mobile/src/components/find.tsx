import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useOverlay } from "../lib/demo";
import { searchLive, SITE, useLoad, type FilterGroup } from "../lib/live";
import { BEST_FOR, MENTORS, SERVICES, type Mentor } from "../lib/sample";
import { MentorCard } from "./shared";
import { Btn, Btns2, Card, Chips, Eyebrow, FChip, FChipRow, Half, H, Link, Loading, Note, RowV, Search, Sec, Seg, Small, T, TT } from "./ui";

// Live mentors seen in a list, so a profile can show their card while the full profile loads.
export const liveCache = new Map<string, Mentor>();

type F = Record<string, string | null>;

// Find a Mentor. Students in the preview can switch between the invented
// mentors and the real ones on mentorsmd.com; visitors see the real ones.
export function FindBody({ allowSample }: { allowSample: boolean }) {
  const [source, setSource] = useState<"sample" | "live">(allowSample ? "sample" : "live");
  return (
    <>
      <T>Find a Mentor</T>
      {allowSample ? <Seg options={[["sample", "Sample mentors"], ["live", "Live on mentorsmd.com"]]} value={source} onChange={setSource} /> : null}
      {source === "sample" ? <SampleFind /> : <LiveFind />}
    </>
  );
}

function SampleFind() {
  const router = useRouter();
  const { openSheet } = useOverlay();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>({ svc: null, best: null, price: null });
  const toggle = (k: string, v: string) => setF((p) => ({ ...p, [k]: p[k] === v ? null : v }));
  const ql = q.toLowerCase();
  const list = MENTORS.filter((m) =>
    (!f.svc || m.svc.includes(f.svc)) && (!f.best || m.best.includes(f.best)) && (!f.price || (f.price === "low" ? m.rate < 100 : m.rate >= 100)) &&
    (!ql || (m.name + m.school + m.svc.map((s) => SERVICES[s]).join(" ") + m.best.join(" ")).toLowerCase().includes(ql)));
  const quick: [string, string][] = [["PERSONAL_STATEMENT", "Personal Statement"], ["SECONDARIES", "Secondaries"], ["MMI", "Interviews"], ["MCAT", "MCAT"], ["REAPPLICANT", "Reapplying"]];
  const clear = () => { setF({ svc: null, best: null, price: null }); setQ(""); };
  const filters = () =>
    openSheet(() => <SampleFilters f={f} toggle={toggle} clear={clear} />);
  return (
    <>
      <Search value={q} onChange={setQ} placeholder="Search by topic, school or exam" />
      <FChipRow>{quick.map(([v, l]) => <FChip key={v} label={l} on={f.svc === v} onPress={() => toggle("svc", v)} />)}</FChipRow>
      <RowV style={{ justifyContent: "space-between" }}>
        <RowV gap={4}><Small>{list.length} mentor{list.length === 1 ? "" : "s"} · Top rated ·</Small><Link label="Reviews" onPress={() => router.push("/reviews")} /></RowV>
        <Link label={`Filters${f.best || f.price ? " · on" : ""}`} onPress={filters} />
      </RowV>
      {list.length ? list.map((m) => <MentorCard key={m.id} m={m} />) : (
        <Card><TT>No mentors match those filters yet.</TT><Note>Try removing a filter, or browse everyone.</Note><Btn kind="line" label="Show all mentors" onPress={clear} /></Card>
      )}
    </>
  );
}

// The filter sheet keeps its own copy so chips light up as you tap.
function SampleFilters({ f, toggle, clear }: { f: F; toggle: (k: string, v: string) => void; clear: () => void }) {
  const { closeSheet } = useOverlay();
  const [mine, setMine] = useState(f);
  const t = (k: string, v: string) => { toggle(k, v); setMine((p) => ({ ...p, [k]: p[k] === v ? null : v })); };
  const best = [...new Set([...BEST_FOR.filter((b) => MENTORS.some((m) => m.best.includes(b))), ...MENTORS.flatMap((m) => m.best)])];
  return (
    <>
      <H>Filters</H>
      <Sec><Eyebrow>Best for</Eyebrow><Chips>{best.map((v) => <FChip key={v} label={v} on={mine.best === v} onPress={() => t("best", v)} />)}</Chips></Sec>
      <Sec><Eyebrow>Specialties</Eyebrow><Chips>{Object.entries(SERVICES).map(([v, l]) => <FChip key={v} label={l} on={mine.svc === v} onPress={() => t("svc", v)} />)}</Chips></Sec>
      <Sec><Eyebrow>Price</Eyebrow><Chips><FChip label="Under $100/hr" on={mine.price === "low"} onPress={() => t("price", "low")} /><FChip label="$100/hr and up" on={mine.price === "high"} onPress={() => t("price", "high")} /></Chips></Sec>
      <Btns2><Half><Btn kind="line" label="Clear" onPress={() => { clear(); closeSheet(); }} /></Half><Half><Btn kind="dark" label="Show mentors" onPress={closeSheet} /></Half></Btns2>
    </>
  );
}

function LiveFind() {
  const { openSheet } = useOverlay();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [f, setF] = useState<F>({});
  const { data, error, loading, reload } = useLoad(() => searchLive({ q: query || null, ...f }), [query, JSON.stringify(f)]);
  data?.mentors.forEach((m) => liveCache.set(m.id, m));
  const set = (k: string, v: string | null) => setF((p) => ({ ...p, [k]: p[k] === v ? null : v }));
  const quick = (data?.quickLinks || []).filter((l) => l.qs);
  const on = Object.values(f).some(Boolean);
  return (
    <>
      <Search value={q} onChange={(v) => { setQ(v); if (!v) setQuery(""); }} onSubmit={() => setQuery(q.trim())} placeholder="Search by topic, school or exam" />
      {quick.length ? (
        <FChipRow>
          {quick.map((l) => {
            const [k, v] = l.qs.split("=");
            return <FChip key={l.qs} label={l.label} on={f[k] === v} onPress={() => set(k, v)} />;
          })}
        </FChipRow>
      ) : null}
      <RowV style={{ justifyContent: "space-between" }}>
        <Small>{loading ? "Loading…" : data ? `${data.mentors.length} mentor${data.mentors.length === 1 ? "" : "s"} on mentorsmd.com` : " "}</Small>
        {data?.filters.length ? <Link label={`Filters${on ? " · on" : ""}`} onPress={() => openSheet(() => <LiveFilters groups={data.filters} f={f} set={set} clear={() => setF({})} />)} /> : null}
      </RowV>
      {loading && !data ? <Loading label="Loading mentors from mentorsmd.com" /> : null}
      {error ? <Card tone="warn"><TT>Couldn’t load mentors</TT><Note>{error}. Check your connection and try again.</Note><Btn kind="line" label="Try again" onPress={reload} /></Card> : null}
      {data && !data.mentors.length ? <Card><TT>No mentors match yet.</TT><Note>Try removing a filter.</Note><Btn kind="line" label="Show all mentors" onPress={() => { setF({}); setQ(""); setQuery(""); }} /></Card> : null}
      {data?.mentors.map((m) => <MentorCard key={m.id} m={m} />)}
      <View style={{ gap: 6 }}>
        <Small>These are the real mentors, read live from {SITE.replace("https://", "")}. Buying and messaging them happens on the website for now.</Small>
        <Link label="Reviews" onPress={() => router.push("/reviews")} />
      </View>
    </>
  );
}

function LiveFilters({ groups, f, set, clear }: { groups: FilterGroup[]; f: F; set: (k: string, v: string | null) => void; clear: () => void }) {
  const { closeSheet } = useOverlay();
  const [mine, setMine] = useState(f);
  const t = (k: string, v: string) => { set(k, v); setMine((p) => ({ ...p, [k]: p[k] === v ? null : v })); };
  return (
    <>
      <H>Filters</H>
      {groups.map((g) => (
        <Sec key={g.key}><Eyebrow>{g.title}</Eyebrow><Chips>{g.options.map((o) => <FChip key={o.value} label={o.label} on={mine[g.key] === o.value} onPress={() => t(g.key, o.value)} />)}</Chips></Sec>
      ))}
      <Btns2><Half><Btn kind="line" label="Clear" onPress={() => { clear(); closeSheet(); }} /></Half><Half><Btn kind="dark" label="Show mentors" onPress={closeSheet} /></Half></Btns2>
    </>
  );
}
