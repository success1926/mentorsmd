import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { useOverlay } from "../lib/demo";
import type { Status } from "../lib/sample";
import { fonts, useColors, type Colors } from "../lib/theme";

export type IconName = ComponentProps<typeof Feather>["name"];
export const Icon = ({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) => {
  const c = useColors();
  return <Feather name={name} size={size} color={color || c.ink} />;
};

// The graduation cap with the stethoscope tassel (the website's logo).
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M20 8 L36 15 L20 22 L4 15 Z" fill="#5536D6" />
      <Path d="M11 18.5 V25 C11 28 15 30 20 30 C25 30 29 28 29 25 V18.5 L20 22.5 Z" fill="#2B1F6B" />
      <Path d="M33 16 V24" stroke="#F07FA6" strokeWidth={1.6} fill="none" />
      <Circle cx={33} cy={26.5} r={2.4} fill="none" stroke="#F07FA6" strokeWidth={1.6} />
    </Svg>
  );
}

// ---------- screens ----------
// A screen: safe area at the top, scrolling content with 20pt sides.
// `footer` stays pinned under the content (a message box, say) and moves up with the keyboard.
export function Screen({ children, footer, edges = ["top"], scroll = true }: { children: ReactNode; footer?: ReactNode; edges?: ("top" | "bottom")[]; scroll?: boolean }) {
  const c = useColors();
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 18, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>{children}</View>
  );
  return (
    <SafeAreaView edges={footer ? [...edges, "bottom"] : edges} style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {body}
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line, backgroundColor: c.bg }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Hdr({ title, sub }: { title: string; sub?: string }) {
  const c = useColors();
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.wash, alignItems: "center", justifyContent: "center" }}>
        <Icon name="chevron-left" size={22} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 17, color: c.ink }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.muted }} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const c = useColors();
  return (
    <View style={{ padding: 32, alignItems: "center", gap: 10 }}>
      <ActivityIndicator color={c.primary} />
      {label ? <Small>{label}</Small> : null}
    </View>
  );
}

// ---------- text ----------
type TP = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };
export function T({ children, style }: TP) {
  const c = useColors();
  return <Text style={[{ fontFamily: fonts.display, fontSize: 34, lineHeight: 37, letterSpacing: -0.6, color: c.ink }, style]}>{children}</Text>;
}
export function H({ children, style }: TP) {
  const c = useColors();
  return <Text style={[{ fontFamily: fonts.displayRegular, fontSize: 22, lineHeight: 27, color: c.ink }, style]}>{children}</Text>;
}
export function Eyebrow({ children, style }: TP) {
  const c = useColors();
  return <Text style={[{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: c.primary }, style]}>{children}</Text>;
}
export function Note({ children, style, ink }: TP & { ink?: boolean }) {
  const c = useColors();
  return <Text style={[{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: ink ? c.ink : c.muted }, style]}>{children}</Text>;
}
export function Small({ children, style }: TP) {
  const c = useColors();
  return <Text style={[{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: c.muted }, style]}>{children}</Text>;
}
export function TT({ children, style, numberOfLines }: TP) {
  const c = useColors();
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: c.ink }, style]}>{children}</Text>;
}
export function SS({ children, style, numberOfLines }: TP) {
  const c = useColors();
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: c.muted }, style]}>{children}</Text>;
}
export function Price({ children, style }: TP) {
  const c = useColors();
  return <Text style={[{ fontFamily: fonts.bodyBold, fontSize: 15, color: c.ink, fontVariant: ["tabular-nums"] }, style]}>{children}</Text>;
}
export function Stars({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: c.primary }}>{children}</Text>;
}

// ---------- layout ----------
export const Sec = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[{ gap: 10 }, style]}>{children}</View>;
export const SecH = ({ children }: { children: ReactNode }) => <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>{children}</View>;
export const RowV = ({ children, gap = 10, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
export const Grow = ({ children, gap = 2 }: { children: ReactNode; gap?: number }) => <View style={{ flex: 1, minWidth: 0, gap }}>{children}</View>;
export const Spacer = () => <View style={{ flex: 1 }} />;

type Tone = "plain" | "tint" | "warn" | "danger";
function toneStyle(c: Colors, tone: Tone): ViewStyle {
  if (tone === "tint") return { backgroundColor: c.tintSoft, borderColor: "transparent" };
  if (tone === "warn") return { backgroundColor: c.warnBg, borderColor: "transparent" };
  if (tone === "danger") return { backgroundColor: c.dangerBg, borderColor: "transparent" };
  return { backgroundColor: c.surface, borderColor: c.line };
}
export function Card({ children, tone = "plain", onPress, row, style }: { children: ReactNode; tone?: Tone; onPress?: () => void; row?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const base: ViewStyle = { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10, ...toneStyle(c, tone), ...(row ? { flexDirection: "row", alignItems: "center", gap: 12 } : null) };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.75 }, style]}>
      {children}
    </Pressable>
  );
}

export function Row({ tt, ss, rr, onPress, left, chevron = true, last }: { tt: ReactNode; ss?: ReactNode; rr?: ReactNode; onPress?: () => void; left?: ReactNode; chevron?: boolean; last?: boolean }) {
  const c = useColors();
  const inner = (
    <>
      {left}
      <Grow>
        {typeof tt === "string" ? <TT>{tt}</TT> : tt}
        {ss ? typeof ss === "string" ? <SS>{ss}</SS> : ss : null}
      </Grow>
      {rr ? typeof rr === "string" ? <SS style={{ textAlign: "right" }}>{rr}</SS> : rr : null}
      {onPress && chevron ? <Icon name="chevron-right" size={18} color={c.faint} /> : null}
    </>
  );
  const style: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderColor: c.line };
  if (!onPress) return <View style={style}>{inner}</View>;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}>{inner}</Pressable>;
}

export function Av({ init, photo, size = 44, pink, onPress }: { init: string; photo?: string | null; size?: number; pink?: boolean; onPress?: () => void }) {
  const c = useColors();
  const body = photo ? (
    <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.avatar }} contentFit="cover" />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: pink ? c.pinkSoft : c.avatar, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.displayRegular, fontSize: size * 0.38, color: pink ? c.danger : c.deep }}>{init}</Text>
    </View>
  );
  if (!onPress) return body;
  return <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={onPress}>{body}</Pressable>;
}

type ChipTone = "plain" | "ok" | "warn" | "bad" | "gray";
export function Chip({ label, tone = "plain" }: { label: string; tone?: ChipTone }) {
  const c = useColors();
  const map: Record<ChipTone, [string, string]> = { plain: [c.tint, c.deep], ok: [c.okBg, c.okFg], warn: [c.warnBg, c.warnFg], bad: [c.dangerBg, c.danger], gray: [c.wash, c.muted] };
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: fg }}>{label}</Text>
    </View>
  );
}
export const Chips = ({ children }: { children: ReactNode }) => <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{children}</View>;

const STATUS: Record<Status, [string, ChipTone]> = {
  PENDING_PAYMENT: ["Waiting for payment", "gray"],
  IN_ESCROW: ["In progress", "ok"],
  COMPLETED: ["Waiting for approval", "warn"],
  RELEASED: ["Approved", "plain"],
  REFUNDED: ["Refunded", "bad"],
  DISPUTE: ["Dispute", "bad"],
  REVISION: ["Revision requested", "warn"],
};
export const StatusChip = ({ status }: { status: Status }) => <Chip label={STATUS[status][0]} tone={STATUS[status][1]} />;

export function FChip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress}
      style={{ borderWidth: 1, borderColor: on ? c.ink : c.line, backgroundColor: on ? c.ink : c.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: on ? c.bg : c.ink }}>{label}</Text>
    </Pressable>
  );
}
// Filter chips that scroll sideways, edge to edge.
export function FChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: "center" }}>
      {children}
    </ScrollView>
  );
}

type BtnKind = "plain" | "dark" | "line" | "red" | "black";
export function Btn({ label, kind = "plain", sm, onPress, disabled, icon, style }: { label: string; kind?: BtnKind; sm?: boolean; onPress?: () => void; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const map: Record<BtnKind, [string, string, string?]> = {
    plain: [c.button, c.ink], dark: [c.primary, c.onPrimary], line: [c.surface, c.ink, c.line], red: [c.danger, c.bg], black: [c.ink, c.bg],
  };
  const [bg, fg, border] = map[kind];
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{
        height: sm ? 40 : 48, borderRadius: 12, backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: border, paddingHorizontal: sm ? 16 : 12,
        alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, alignSelf: sm ? "flex-start" : "stretch", opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      }, style]}>
      {icon ? <Feather name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: sm ? 14 : 15, color: fg }}>{label}</Text>
    </Pressable>
  );
}
export const Btns2 = ({ children }: { children: ReactNode }) => <View style={{ flexDirection: "row", gap: 8 }}>{children}</View>;
export const Half = ({ children }: { children: ReactNode }) => <View style={{ flex: 1 }}>{children}</View>;

export function Link({ label, onPress, red, style }: { label: string; onPress?: () => void; red?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={[{ alignSelf: "flex-start" }, style]}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: red ? c.danger : c.link }}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ label, value, onPress, small }: { label: string; value: string; onPress?: () => void; small?: boolean }) {
  const c = useColors();
  const body = (
    <>
      <Text style={{ fontFamily: small ? fonts.bodyMedium : fonts.bodySemi, fontSize: 12, color: small ? c.muted : c.deep }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: small ? 19 : 22, color: c.ink, fontVariant: ["tabular-nums"] }}>{value}</Text>
    </>
  );
  const style: ViewStyle = { flex: 1, minWidth: 0, backgroundColor: small ? c.wash : c.tint, borderRadius: small ? 12 : 16, padding: small ? 10 : 14, gap: 2 };
  if (!onPress) return <View style={style}>{body}</View>;
  return <Pressable onPress={onPress} style={style}>{body}</Pressable>;
}
// Small stat boxes put their value first, like the website.
export function Stat3({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: c.wash, borderRadius: 12, padding: 10, gap: 2 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 19, color: c.ink }}>{value}</Text>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: c.muted }}>{label}</Text>
    </View>
  );
}
// Two stats a row.
export function Stats({ children }: { children: ReactNode[] }) {
  const rows: ReactNode[][] = [];
  children.forEach((ch, i) => (i % 2 ? rows[rows.length - 1].push(ch) : rows.push([ch])));
  return <View style={{ gap: 10 }}>{rows.map((r, i) => <View key={i} style={{ flexDirection: "row", gap: 10 }}>{r}</View>)}</View>;
}

export function Bar({ pct }: { pct: number }) {
  const c = useColors();
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: c.tint, overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: c.primary, borderRadius: 999 }} />
    </View>
  );
}

export function DateBox({ dow, day }: { dow: string; day: string }) {
  const c = useColors();
  return (
    <View style={{ width: 52, alignItems: "center", borderRadius: 12, backgroundColor: c.blue, paddingVertical: 6 }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: c.blueInk }}>{dow}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: c.blueInk }}>{day}</Text>
    </View>
  );
}

export function Search({ value, onChange, placeholder, onSubmit }: { value: string; onChange: (v: string) => void; placeholder: string; onSubmit?: () => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 48, borderRadius: 14, backgroundColor: c.wash, paddingHorizontal: 14 }}>
      <Icon name="search" size={20} color={c.muted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.faint} accessibilityLabel={placeholder}
        returnKeyType="search" onSubmitEditing={onSubmit} autoCorrect={false}
        style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: c.ink }} />
      {value ? <Pressable onPress={() => onChange("")} hitSlop={8} accessibilityLabel="Clear search"><Icon name="x" size={18} color={c.muted} /></Pressable> : null}
    </View>
  );
}

export function Field({ label, value, onChange, multiline, placeholder, numeric, secure, big }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; numeric?: boolean; secure?: boolean; big?: boolean }) {
  const c = useColors();
  const isEmail = label.toLowerCase().includes("email");
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: c.ink }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} multiline={multiline} placeholder={placeholder} placeholderTextColor={c.faint} accessibilityLabel={label}
        keyboardType={numeric ? "number-pad" : isEmail ? "email-address" : "default"} secureTextEntry={secure} autoCapitalize={secure || isEmail ? "none" : "sentences"}
        autoCorrect={!(secure || isEmail || numeric)} spellCheck={!(secure || isEmail || numeric)}
        textContentType={isEmail ? "username" : secure ? "password" : numeric ? "oneTimeCode" : "none"} autoComplete={isEmail ? "email" : secure ? "current-password" : numeric ? "one-time-code" : "off"}
        style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 12, padding: 12, fontFamily: fonts.body, fontSize: big ? 24 : 15, letterSpacing: big ? 4 : 0, textAlign: big ? "center" : "left", color: c.ink, minHeight: multiline ? 96 : undefined, textAlignVertical: multiline ? "top" : "center" }} />
    </View>
  );
}

// A dropdown: tap to pick from a sheet.
export function Select({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const c = useColors();
  const { openSheet, closeSheet } = useOverlay();
  const pick = () =>
    openSheet(() => (
      <>
        <H>{label}</H>
        <View>
          {options.map((o, i) => (
            <Row key={o} tt={o} last={i === options.length - 1} chevron={false} rr={o === value ? <Icon name="check" color={c.primary} /> : undefined} onPress={() => { onChange(o); closeSheet(); }} />
          ))}
        </View>
      </>
    ));
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: c.ink }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={pick}
        style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: c.ink }}>{value}</Text>
        <Icon name="chevron-down" size={18} color={c.muted} />
      </Pressable>
    </View>
  );
}

export function Seg<V extends string | number>({ options, value, onChange }: { options: [V, string][]; value: V; onChange: (v: V) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", backgroundColor: c.wash, borderRadius: 12, padding: 4, gap: 4 }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable key={String(v)} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(v)}
            style={{ flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: "center", backgroundColor: on ? c.surface : "transparent", ...(on ? { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null) }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: on ? c.ink : c.muted }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ tt, ss, value, onChange, last }: { tt: string; ss?: string; value?: boolean; onChange?: (v: boolean) => void; last?: boolean }) {
  const c = useColors();
  const [own, setOwn] = useState(value ?? true);
  const on = value ?? own;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderColor: c.line }}>
      <Grow><TT>{tt}</TT>{ss ? <SS>{ss}</SS> : null}</Grow>
      <Switch accessibilityLabel={tt} value={on} onValueChange={(v) => (onChange ? onChange(v) : setOwn(v))} trackColor={{ true: c.primary, false: c.line }} thumbColor="#FFFFFF" ios_backgroundColor={c.line} />
    </View>
  );
}

export function KV({ k, v, total, vColor, kInk, line }: { k: string; v: ReactNode; total?: boolean; vColor?: string; kInk?: boolean; line?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: line ? 10 : 6, ...(total ? { borderTopWidth: 1, borderColor: c.line, paddingTop: 10, marginTop: 4 } : null), ...(line ? { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line } : null) }}>
      <Text style={{ fontFamily: fonts.body, fontSize: total ? 16 : 14, color: kInk ? c.ink : c.muted, flexShrink: 1 }}>{k}</Text>
      {typeof v === "string" ? <Text style={{ fontFamily: line ? fonts.bodyMedium : fonts.bodyBold, fontSize: total ? 16 : 14, color: vColor || (line ? c.muted : c.ink), textAlign: "right", flexShrink: 1, maxWidth: "62%", fontVariant: ["tabular-nums"] }}>{v}</Text> : v}
    </View>
  );
}

export function Bubble({ who, children }: { who: "me" | "them" | "sys"; children: ReactNode }) {
  const c = useColors();
  const box: ViewStyle =
    who === "me" ? { backgroundColor: c.primary, alignSelf: "flex-end", borderBottomRightRadius: 6 }
      : who === "them" ? { backgroundColor: c.wash, alignSelf: "flex-start", borderBottomLeftRadius: 6 }
        : { backgroundColor: c.tint, alignSelf: "center", borderRadius: 10, maxWidth: "92%" };
  const color = who === "me" ? c.onPrimary : who === "sys" ? c.deep : c.ink;
  return (
    <View style={[{ maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 }, box]}>
      <Text style={{ fontFamily: fonts.body, fontSize: who === "sys" ? 12.5 : 14.5, lineHeight: who === "sys" ? 17 : 20, color, textAlign: who === "sys" ? "center" : "left" }}>{children}</Text>
    </View>
  );
}

export function Composer({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => void }) {
  const c = useColors();
  const [v, setV] = useState("");
  const send = () => {
    const t = v.trim();
    if (!t) return;
    onSend(t);
    setV("");
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <TextInput value={v} onChangeText={setV} placeholder={placeholder} placeholderTextColor={c.faint} accessibilityLabel={placeholder} onSubmitEditing={send} returnKeyType="send"
        style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 15, color: c.ink }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={send} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
        <Feather name="send" size={18} color={c.onPrimary} />
      </Pressable>
    </View>
  );
}

// A lettered crest for a school (the website shows this when there's no logo uploaded).
const LOGO_COLORS = ["#BFB0FF", "#F5B9CD", "#BFE3D0", "#FFD9A8", "#B9D7FF", "#E2C7FF", "#FFC6B3", "#D7E8A8"];
const SKIP = /^(of|at|the|and|University|School|Medicine|College|Medical|Osteopathic|Starting|PLME|\d+)$/i;
export function SchoolLogo({ name, size = 22 }: { name: string; size?: number }) {
  const words = name.replace(/\(.*?\)/g, "").split(/[\s,·-]+/).filter((x) => x && !SKIP.test(x));
  const letters = (words.length ? words : name.split(" ")).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <View accessibilityLabel={name} style={{ width: size, height: size, borderRadius: 6, backgroundColor: LOGO_COLORS[h % LOGO_COLORS.length], alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: Math.round(size * 0.4), color: "#1B1834" }}>{letters}</Text>
    </View>
  );
}
export function SchoolList({ schools, size = 24 }: { schools: string[]; size?: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 8 }}>
      {schools.map((s) => (
        <View key={s} style={{ width: "50%", flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 6 }}>
          <SchoolLogo name={s} size={size} />
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.ink, flexShrink: 1 }}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------- overlays (one copy, in the root layout) ----------
export function Overlays() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { sheet: SheetBody, closeSheet, toastMsg, faceOn } = useOverlay();
  const Body = SheetBody;
  return (
    <>
      <Modal visible={!!Body} transparent animationType="slide" onRequestClose={closeSheet}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={closeSheet} accessibilityLabel="Close" />
          <View style={{ maxHeight: "88%", backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 20 + insets.bottom, gap: 14 }} keyboardShouldPersistTaps="handled">
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line, alignSelf: "center" }} />
              {Body ? <Body /> : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={faceOn} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: c.scrim, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 170, height: 170, borderRadius: 30, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Feather name="smile" size={56} color={c.primary} />
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink }}>Face ID</Text>
          </View>
        </View>
      </Modal>
      {toastMsg ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 20, right: 20, bottom: 96 + insets.bottom, backgroundColor: c.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.bg }}>{toastMsg}</Text>
        </View>
      ) : null}
    </>
  );
}
