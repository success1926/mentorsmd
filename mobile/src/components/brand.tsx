import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useCompare, type MatchResult } from "../lib/match";
import { fonts, useColors } from "../lib/theme";
import { Av, Icon } from "./ui";
import { firstName } from "../lib/format";
import { type Mentor } from "../lib/live";

// Pieces shared by Find a Mentor, the profile and Compare (Nov 2026 Browse
// redesign, matching the website).

// The website's hero background: white to lavender, with soft blue, pink and
// lavender glows (the homepage blobs). Fills its parent; put content on top.
export function HeroGlow({ id = "g" }: { id?: string }) {
  const dark = useColorScheme() === "dark";
  const stops = dark ? ["#110E22", "#171232", "#1F1840"] : ["#FFFFFF", "#F6F2FF", "#E9E2FF"];
  const blob = dark ? ["#1C2642", "#3A2030", "#2F2760"] : ["#E4EEFF", "#F5B9CD", "#CFC4FF"];
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <LinearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="0.45" stopColor={stops[1]} />
          <Stop offset="1" stopColor={stops[2]} />
        </LinearGradient>
        <RadialGradient id={`${id}a`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={blob[0]} stopOpacity={0.95} />
          <Stop offset="1" stopColor={blob[0]} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}b`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={blob[1]} stopOpacity={dark ? 0.6 : 0.5} />
          <Stop offset="1" stopColor={blob[1]} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}c`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={blob[2]} stopOpacity={0.55} />
          <Stop offset="1" stopColor={blob[2]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}l)`} />
      <Rect x="-35" y="45" width="90" height="70" fill={`url(#${id}a)`} />
      <Rect x="45" y="25" width="90" height="70" fill={`url(#${id}b)`} />
      <Rect x="15" y="-25" width="80" height="50" fill={`url(#${id}c)`} />
    </Svg>
  );
}

// A full-width band with the hero glow behind it (cancels the screen's 20pt sides).
export function GlowBand({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <View style={{ marginHorizontal: -20, marginTop: -8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, overflow: "hidden", gap: 10 }}>
      <HeroGlow id={id} />
      {children}
    </View>
  );
}

// A pick in the guided match: lavender when on (like the website), with how
// many mentors it would match on its own.
export function PickChip({ label, on, count, onPress }: { label: string; on?: boolean; count?: number; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: on ? c.button : c.line, backgroundColor: on ? c.button : c.surface, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}>
      <Text style={{ fontFamily: on ? fonts.bodySemi : fonts.bodyMedium, fontSize: 13.5, color: c.ink }}>{label}</Text>
      {count !== undefined ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: on ? c.ink : c.faint }}>{count}</Text> : null}
    </Pressable>
  );
}

// A picked option, shown above the results; tap to remove.
export function PickedPill({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.deep, borderRadius: 999, paddingLeft: 12, paddingRight: 8, paddingVertical: 6 }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12.5, color: c.bg }}>{label}</Text>
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 11, lineHeight: 13, color: c.bg }}>×</Text>
      </View>
    </Pressable>
  );
}

// "▬▬ Matches all 2 of your picks" / "Matches 1 of 2 · not who you are".
export function WhyLine({ r }: { r: MatchResult }) {
  const c = useColors();
  if (!r.total) return null;
  const missing = r.groups.filter((g) => !g.hit).map((g) => g.short).join(", ");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {r.groups.map((g) => <View key={g.key} style={{ width: 14, height: 5, borderRadius: 3, backgroundColor: g.hit ? c.primary : c.avatar }} />)}
      </View>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12.5, color: c.primary, flexShrink: 1 }}>
        {r.full ? (r.total === 1 ? "Matches your picks" : `Matches all ${r.total} of your picks`) : `Matches ${r.hit} of ${r.total} · not ${missing}`}
      </Text>
    </View>
  );
}

// A tag on a mentor card; picked ones are highlighted.
export function Tag({ label, hit }: { label: string; hit?: boolean }) {
  const c = useColors();
  return (
    <View style={{ borderWidth: 1, borderColor: hit ? c.button : c.line, backgroundColor: hit ? c.tint : c.wash, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ fontFamily: hit ? fonts.bodySemi : fonts.bodyMedium, fontSize: 12, color: hit ? c.deep : c.ink }}>{label}</Text>
    </View>
  );
}

// The Compare tick box on cards and profiles.
export function CompareTick({ m, label = "Compare" }: { m: Mentor; label?: string }) {
  const c = useColors();
  const cmp = useCompare();
  const on = cmp.has(m.id);
  const off = !on && cmp.full;
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: off }} disabled={off} hitSlop={8} onPress={() => cmp.toggle(m)}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: off ? 0.45 : 1, alignSelf: "flex-start" }}>
      <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: on ? c.primary : c.avatar, backgroundColor: on ? c.primary : c.surface, alignItems: "center", justifyContent: "center" }}>
        {on ? <Icon name="check" size={13} color={c.onPrimary} /> : null}
      </View>
      <Text style={{ fontFamily: on ? fonts.bodySemi : fonts.bodyMedium, fontSize: 13.5, color: on ? c.primary : c.muted }}>{on ? "Comparing" : off ? "Compare (3 max)" : label}</Text>
    </Pressable>
  );
}

// For a screen's pinned footer: the compare bar, only while mentors are ticked.
export function useCompareFooter() {
  const n = useCompare().items.length;
  return n ? <CompareBar /> : undefined;
}

// Pinned under Find and profiles while mentors are ticked. Opens /compare.
export function CompareBar() {
  const router = useRouter();
  const cmp = useCompare();
  const n = cmp.items.length;
  if (!n) return null;
  return (
    <View style={{ backgroundColor: "#2B1F6B", borderRadius: 18, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ fontFamily: fonts.displayRegular, fontSize: 19, color: "#FFFFFF" }}>{n > 1 ? `Comparing ${n} mentors` : "Pick one more to compare"}</Text>
        <Pressable accessibilityRole="button" onPress={cmp.clear} hitSlop={8}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: "#DDD5FF" }}>Clear</Text></Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {cmp.items.map((m) => (
          <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingLeft: 3, paddingRight: 4, paddingVertical: 3 }}>
            <Av init={m.init} photo={m.photo} size={26} />
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: "#FFFFFF" }}>{firstName(m.name)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} onPress={() => cmp.remove(m.id)} hitSlop={6}
              style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 12, lineHeight: 14 }}>×</Text>
            </Pressable>
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" disabled={n < 2} onPress={() => router.push("/compare")}
          style={({ pressed }) => ({ backgroundColor: "#BFB0FF", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, opacity: n < 2 ? 0.5 : pressed ? 0.85 : 1 })}>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: "#1B1834" }}>Compare</Text>
        </Pressable>
      </View>
    </View>
  );
}
