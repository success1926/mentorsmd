import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { HeroGlow } from "../components/brand";
import { Av, Btn, Card, Eyebrow, Hdr, Link, Note, Screen, Small } from "../components/ui";
import { BEST_LABEL, SERVICE_OPTIONS, hasService, useCompare } from "../lib/match";
import { first, money } from "../lib/sample";
import { fonts, useColors } from "../lib/theme";

const ROLE: Record<string, string> = { COMMITTEE: "Admissions committee", INTERVIEWER: "Interviewer", SCREENER: "Application screener" };

// Compare up to three mentors side by side (the website's compare tray).
export default function Compare() {
  const c = useColors();
  const router = useRouter();
  const cmp = useCompare();
  const ms = cmp.items;
  if (ms.length < 2) {
    return (
      <Screen>
        <Hdr title="Compare mentors" />
        <Card tone="tint"><Note ink>Tick “Compare” on two or three mentors in Find a Mentor to see them side by side.</Note><Btn kind="line" label="Back to Find a Mentor" onPress={() => router.back()} /></Card>
      </Screen>
    );
  }
  const lowest = Math.min(...ms.map((m) => m.match.fromRate || m.rate));
  const services = SERVICE_OPTIONS.filter(([v]) => ms.some((m) => hasService(m, v)));
  const Row = ({ label, cells, hl }: { label: string; cells: ReactNode[]; hl?: boolean }) => (
    <View style={{ gap: 6, paddingVertical: 10, borderTopWidth: 1, borderColor: c.line, backgroundColor: hl ? c.tintSoft : undefined }}>
      <Eyebrow style={{ color: c.muted }}>{label}</Eyebrow>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {cells.map((x, i) => (
          <View key={i} style={{ flex: 1, minWidth: 0 }}>
            {typeof x === "string" ? <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: c.ink }}>{x}</Text> : x}
          </View>
        ))}
      </View>
    </View>
  );
  const yes = <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.primary }}>✓</Text>;
  const no = <Text style={{ fontFamily: fonts.body, fontSize: 16, color: c.faint }}>—</Text>;
  return (
    <Screen>
      <Hdr title="Compare mentors" sub={`${ms.length} side by side`} />
      <View style={{ marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 16, overflow: "hidden", flexDirection: "row", gap: 10 }}>
        <HeroGlow id="cmp" />
        {ms.map((m) => (
          <View key={m.id} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 6 }}>
            <Av init={m.init} photo={m.photo} size={60} onPress={() => router.push(`/profile/${m.id}`)} />
            <Text style={{ fontFamily: fonts.displayRegular, fontSize: 17, lineHeight: 20, color: c.ink, textAlign: "center" }} numberOfLines={2}>{m.name}</Text>
            <Small style={{ textAlign: "center" }} numberOfLines={2}>{m.stage}</Small>
            <Link label="Remove" onPress={() => cmp.remove(m.id)} style={{ alignSelf: "center" }} />
          </View>
        ))}
      </View>
      <View>
        <Row label="Rate" cells={ms.map((m) => {
          const r = m.match.fromRate || m.rate;
          return (
            <View style={{ gap: 3 }}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink }}>{money(m.rate)}/hr</Text>
              {r < m.rate ? <Small>from {money(r)}/hr with bundles</Small> : null}
              {r === lowest ? <View style={{ alignSelf: "flex-start", backgroundColor: c.pinkSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: c.ink }}>Lowest</Text></View> : null}
            </View>
          );
        })} />
        <Row label="School" cells={ms.map((m) => m.school || "—")} />
        <Row label="Packages" cells={ms.map((m) => (m.match.packageCount ? `${m.match.packageCount} ${m.match.packageCount === 1 ? "package" : "packages"}` : "Hours only"))} />
        <Row label="Best for" cells={ms.map((m) => m.match.best.map((b) => BEST_LABEL[b] || b).join(", ") || "—")} />
        {services.map(([v, l]) => <Row key={v} label={l} cells={ms.map((m) => (hasService(m, v) ? yes : no))} />)}
        <Row label="Admissions roles" cells={ms.map((m) => [...new Set(m.match.roleTypes.map((r) => ROLE[r] || r))].join(" · ") || "—")} />
        <Row label="Known for" cells={ms.map((m) => (m.knownFor?.[0] ? <Text style={{ fontFamily: fonts.displayRegular, fontStyle: "italic", fontSize: 14, color: c.ink }}>“{m.knownFor[0]}”</Text> : "—"))} />
        <Row label="Languages" cells={ms.map((m) => m.match.languages.join(", ") || "—")} />
        <Row label="Reviews" cells={ms.map((m) => (m.reviews ? `★ ${(m.rating ?? 0).toFixed(1)} · ${m.reviews}` : "New to MentorsMD"))} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {ms.map((m) => (
          <View key={m.id} style={{ flex: 1 }}>
            <Btn kind="dark" sm label={first(m.name)} onPress={() => router.push(`/profile/${m.id}`)} style={{ alignSelf: "stretch" }} />
          </View>
        ))}
      </View>
      <Small>Tap a name to open their profile, book a free intro call or message them.</Small>
    </Screen>
  );
}
