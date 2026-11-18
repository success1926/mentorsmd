import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useOverlay } from "../lib/demo";
import { searchLive, SITE, useLoad } from "../lib/live";
import { GROUPS, SERVICE_OPTIONS, emptyPicks, labelOf, matchMentor, optionHit, pickCount, rank, type GuidedKey, type MatchResult, type Picks } from "../lib/match";
import { MENTORS, money, type Mentor } from "../lib/sample";
import { fonts, useColors } from "../lib/theme";
import { CompareTick, GlowBand, PickChip, PickedPill, Tag, WhyLine } from "./brand";
import { Av, Btn, Btns2, Card, Chip, Eyebrow, FChip, FChipRow, H, Half, Link, Loading, Note, RowV, Search, Seg, Small, SS, Stars, T } from "./ui";

// Live mentors seen in a list, so a profile can show their card while the full profile loads.
export const liveCache = new Map<string, Mentor>();

// Find a Mentor (Nov 2026, same as the website's Browse page): tell us who
// you are, what you need and your budget, and mentors are ranked by how
// much they match. Full matches first, then "Also worth a look" with what
// they're missing. Tick up to three to compare. Students in the preview can
// switch between the invented mentors and the real ones on mentorsmd.com;
// visitors see the real ones.
export function FindBody({ allowSample }: { allowSample: boolean }) {
  const [source, setSource] = useState<"sample" | "live">(allowSample ? "sample" : "live");
  return (
    <>
      {source === "sample" ? <SampleFind /> : <LiveFind />}
      {allowSample ? <Seg options={[["sample", "Sample mentors"], ["live", "Live on mentorsmd.com"]]} value={source} onChange={setSource} /> : null}
    </>
  );
}

function SampleFind() {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const list = ql ? MENTORS.filter((m) => (m.name + m.school + m.specialties.join(" ") + m.best.join(" ")).toLowerCase().includes(ql)) : MENTORS;
  return <Guided mentors={list} q={q} setQ={setQ} onSubmit={() => {}} />;
}

function LiveFind() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useLoad(() => searchLive({ q: query || null }), [query]);
  data?.mentors.forEach((m) => liveCache.set(m.id, m));
  return (
    <Guided
      live
      mentors={data?.mentors || []}
      q={q}
      setQ={(v) => { setQ(v); if (!v) setQuery(""); }}
      onSubmit={() => setQuery(q.trim())}
      loading={loading && !data}
      error={error}
      reload={reload}
    />
  );
}

// Quick topics under the search box (the website's quick links).
const QUICK: [GuidedKey, string, string][] = [
  ["service", "PERSONAL_STATEMENT", "Personal Statement"], ["service", "SECONDARIES", "Secondaries"], ["service", "MMI", "MMI"], ["service", "SCHOOL_LIST", "School List"],
  ["service", "MCAT", "MCAT"], ["best", "REAPPLICANT", "Reapplicants"], ["best", "DO", "DO"], ["best", "MD_PHD", "MD-PhD"], ["best", "BS_MD", "BS/MD"],
];
const SORTS: [string, string][] = [["best", "Best match"], ["low", "Lowest price"], ["rated", "Top rated"]];

function Guided({ mentors, q, setQ, onSubmit, live, loading, error, reload }: {
  mentors: Mentor[]; q: string; setQ: (v: string) => void; onSubmit: () => void; live?: boolean; loading?: boolean; error?: string | null; reload?: () => void;
}) {
  const c = useColors();
  const router = useRouter();
  const { openSheet } = useOverlay();
  const [picks, setPicks] = useState<Picks>(emptyPicks);
  const [sort, setSort] = useState("best");
  const toggle = (k: GuidedKey, v: string) => setPicks((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));
  const clear = () => setPicks(emptyPicks());
  const n = pickCount(picks);
  const { full, partial, hidden } = useMemo(() => rank(mentors, picks, sort), [mentors, picks, sort]);
  const choose = () => openSheet(() => <ChooseSheet mentors={mentors} picks={picks} toggle={toggle} clear={clear} />);

  const title = !n ? `${mentors.length} ${mentors.length === 1 ? "mentor" : "mentors"}` : full.length ? `${full.length} best ${full.length === 1 ? "match" : "matches"}` : "No exact matches";
  const sub = !n ? "Pick what you need, or tick two or three mentors to compare." : full.length ? "These mentors cover everything you picked." : "Here are the closest mentors. Try removing a pick.";

  return (
    <>
      <GlowBand id="find">
        <Eyebrow>Vetted mentors</Eyebrow>
        <T>Find Your Mentor</T>
        <Note>Every mentor is vetted by our senior team. Message anyone for free.</Note>
        <Search value={q} onChange={setQ} onSubmit={onSubmit} placeholder="Search by name, school or keyword" />
      </GlowBand>

      <Card style={{ padding: 0, overflow: "hidden", gap: 0, borderColor: c.avatar }}>
        <View style={{ padding: 16, gap: 6, backgroundColor: c.tintSoft }}>
          <H style={{ fontSize: 22, lineHeight: 26 }}>
            Tell us where you are. <Text style={{ fontStyle: "italic", color: c.primary }}>We’ll narrow it down.</Text>
          </H>
          <SS>Mentors are ranked by how much they match.</SS>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          {n ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {GROUPS.flatMap((g) => picks[g.key].map((v) => <PickedPill key={g.key + v} label={labelOf(g.key, v)} onPress={() => toggle(g.key, v)} />))}
            </View>
          ) : null}
          <Btns2>
            <Half><Btn kind={n ? "line" : "plain"} label={n ? `Edit picks (${n})` : "Choose what you need"} onPress={choose} /></Half>
            {n ? <Half><Btn kind="line" label="Clear all" onPress={clear} /></Half> : null}
          </Btns2>
        </View>
      </Card>

      <FChipRow>
        {QUICK.map(([k, v, l]) => <FChip key={k + v} label={l} on={picks[k].includes(v)} onPress={() => toggle(k, v)} />)}
      </FChipRow>

      <View style={{ gap: 4 }}>
        <H>{loading ? "Loading mentors…" : title}</H>
        {!loading ? <SS>{sub}</SS> : null}
      </View>
      <Seg options={SORTS} value={sort} onChange={setSort} />

      {loading ? <Loading label="Loading mentors from mentorsmd.com" /> : null}
      {error ? <Card tone="warn"><Text style={{ fontFamily: fonts.bodySemi, color: c.ink }}>Couldn’t load mentors</Text><Note>{error}. Check your connection and try again.</Note>{reload ? <Btn kind="line" label="Try again" onPress={reload} /> : null}</Card> : null}
      {!loading && !error && !mentors.length ? (
        <Card><Text style={{ fontFamily: fonts.bodySemi, color: c.ink }}>No mentors match that search.</Text><Note>Try a school, a topic like “MMI”, or clear the search.</Note><Btn kind="line" label="Clear search" onPress={() => setQ("")} /></Card>
      ) : null}

      {full.map((x, i) => <MatchCard key={x.m.id} m={x.m} r={x.r} picks={picks} best={n > 0 && i === 0} />)}
      {partial.length ? <GroupLabel text="Also worth a look" /> : null}
      {partial.map((x) => <MatchCard key={x.m.id} m={x.m} r={x.r} picks={picks} />)}
      {hidden ? <GroupLabel text={`${hidden} ${hidden === 1 ? "mentor" : "mentors"} hidden · no match`} /> : null}

      <View style={{ gap: 6 }}>
        {live ? <Small>These are the real mentors, read live from {SITE.replace("https://", "")}. Buying and messaging them happens on the website for now.</Small> : null}
        <Link label="Reviews" onPress={() => router.push("/reviews")} />
      </View>
    </>
  );
}

function GroupLabel({ text }: { text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: c.muted }}>{text}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
    </View>
  );
}

// The three groups, in a sheet. Keeps its own copy so pills light up as you tap.
function ChooseSheet({ mentors, picks, toggle, clear }: { mentors: Mentor[]; picks: Picks; toggle: (k: GuidedKey, v: string) => void; clear: () => void }) {
  const c = useColors();
  const { closeSheet } = useOverlay();
  const [mine, setMine] = useState(picks);
  const t = (k: GuidedKey, v: string) => {
    toggle(k, v);
    setMine((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));
  };
  const n = pickCount(mine);
  const matches = mentors.filter((m) => matchMentor(m, mine).full).length;
  return (
    <>
      <H>What do you need?</H>
      {GROUPS.map((g, i) => (
        <View key={g.key} style={{ gap: 10 }}>
          <RowV gap={8}>
            <Text style={{ fontFamily: fonts.displayRegular, fontStyle: "italic", fontSize: 18, color: c.primary }}>{i + 1}</Text>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink }}>{g.title}</Text>
            <Small style={{ marginLeft: "auto" }}>{g.key === "price" ? "Optional" : "Pick any"}</Small>
          </RowV>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {g.options.map((o) => (
              <PickChip key={o[0]} label={o[1]} on={mine[g.key].includes(o[0])} count={mentors.filter((m) => optionHit(m, g.key, o[0])).length} onPress={() => t(g.key, o[0])} />
            ))}
          </View>
        </View>
      ))}
      <Card tone="tint"><Note ink>Pay for hours, see every one. Buy hours at your mentor’s rate for calls and written work. Message or book a free 15-minute intro call first.</Note></Card>
      <Btns2>
        <Half><Btn kind="line" label="Clear" onPress={() => { clear(); setMine(emptyPicks()); }} /></Half>
        <Half><Btn kind="dark" label={n ? `Show ${matches} ${matches === 1 ? "match" : "matches"}` : "Show mentors"} onPress={closeSheet} /></Half>
      </Btns2>
    </>
  );
}

// A mentor in the results: photo, name, rank and school, why they matched,
// tags (picked ones highlighted), "known for", price, and Compare.
export function MatchCard({ m, r, picks, best }: { m: Mentor; r: MatchResult; picks: Picks; best?: boolean }) {
  const c = useColors();
  const router = useRouter();
  const svcGroup = r.groups.find((g) => g.key === "service");
  const hitSvc = (svcGroup?.matched || []).map((v) => SERVICE_OPTIONS.find((o) => o[0] === v)?.[1] || v);
  const tags: { t: string; hit: boolean }[] = [
    ...hitSvc.map((t) => ({ t, hit: true })),
    ...m.specialties.filter((s) => !hitSvc.some((h) => h.toLowerCase() === s.toLowerCase())).map((t) => ({ t, hit: false })),
    ...m.match.best.map((b) => ({ t: labelOf("best", b), hit: picks.best.includes(b) })),
  ]
    .sort((a, b) => Number(b.hit) - Number(a.hit))
    .filter((x, i, all) => all.findIndex((y) => y.t.toLowerCase() === x.t.toLowerCase()) === i);
  const shown = tags.slice(0, 5);
  const extra = tags.length - shown.length;
  const rate = m.match.fromRate || m.rate;
  return (
    <Card onPress={() => router.push(`/profile/${m.id}`)} style={[{ padding: 14, gap: 10 }, best ? { borderColor: c.button, borderWidth: 2 } : null]}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Av init={m.init} photo={m.photo} size={64} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <RowV gap={8} style={{ flexWrap: "wrap" }}>
            <Text style={{ fontFamily: fonts.displayRegular, fontSize: 21, lineHeight: 24, color: c.ink }}>{m.name}</Text>
            {!m.reviews ? <Chip label="New mentor" /> : null}
          </RowV>
          {m.stage ? <SS style={{ color: c.ink }}>{m.stage}</SS> : null}
          {m.school ? <SS numberOfLines={2}>{m.school}</SS> : null}
          {m.rating != null ? <Stars>★ {m.rating.toFixed(1)} · {m.reviews} reviews</Stars> : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {rate < m.rate ? <Small>from</Small> : null}
          <Text style={{ fontFamily: fonts.displayRegular, fontSize: 24, color: c.ink }}>{money(rate)}</Text>
          <Small>per hour</Small>
        </View>
      </View>
      <WhyLine r={r} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {shown.map((x) => <Tag key={x.t} label={x.t} hit={x.hit} />)}
        {extra > 0 ? <Tag label={`+${extra} more`} /> : null}
      </View>
      {m.knownFor?.[0] ? <Text style={{ fontFamily: fonts.displayRegular, fontStyle: "italic", fontSize: 15, color: c.muted }}>“{m.knownFor[0]}”</Text> : null}
      <RowV style={{ justifyContent: "space-between", borderTopWidth: 1, borderColor: c.line, paddingTop: 10 }}>
        <CompareTick m={m} />
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.link }}>View profile →</Text>
      </RowV>
    </Card>
  );
}
