import * as WebBrowser from "expo-web-browser";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CompareTick, HeroGlow, useCompareFooter } from "../../components/brand";
import { liveCache } from "../../components/find";
import { usePaySheet } from "../../components/shared";
import { Btn, Card, Chip, Chips, Eyebrow, Hdr, Icon, Loading, Note, SchoolList, SchoolLogo, Screen, Small, SS, Stars, TT } from "../../components/ui";
import { useDemo, useOverlay } from "../../lib/demo";
import { liveProfile, SITE, useLoad, type LiveReview } from "../../lib/live";
import { useCompare } from "../../lib/match";
import { first, money, sampleMentor, type Mentor } from "../../lib/sample";
import { fonts, useColors } from "../../lib/theme";

// A mentor's profile (Nov 2026, the website's sticky-sidebar profile as it
// looks on a phone): the card with photo, school, who they're best for,
// rate and the two main buttons on top, then section tabs that stay at the
// top while you scroll, then the sections. Sample mentors come from the
// preview data; real ones load from mentorsmd.com.
export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sample = sampleMentor(id);
  if (sample) return <ProfileView m={sample} />;
  return <LiveProfile id={id} />;
}

function LiveProfile({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => liveProfile(id), [id]);
  const card = liveCache.get(id);
  if (data) return <ProfileView m={{ ...data.mentor, specialties: data.mentor.specialties.length ? data.mentor.specialties : card?.specialties || [], rating: card?.rating ?? data.mentor.rating }} liveReviews={data.reviews} />;
  return (
    <Screen>
      <Hdr title={card?.name || "Mentor"} sub={card?.stage} />
      {loading ? <Loading label="Loading the profile from mentorsmd.com" /> : null}
      {error ? <Card tone="warn"><TT>Couldn’t load this profile</TT><Note>{error}</Note><Btn kind="line" label="Try again" onPress={reload} /></Card> : null}
    </Screen>
  );
}

type Sec = { id: string; label: string; body: ReactNode };

function ProfileView({ m, liveReviews }: { m: Mentor; liveReviews?: LiveReview[] }) {
  const c = useColors();
  const router = useRouter();
  const { role } = useDemo();
  const { toast } = useOverlay();
  const pay = usePaySheet();
  const footer = useCompareFooter();
  const cmp = useCompare();
  const name1 = first(m.name);
  const onSite = () => WebBrowser.openBrowserAsync(`${SITE}/mentors/${m.id}`);
  const asStudent = role === "student";
  // Sample mentors work inside the preview for students; real mentors open
  // their page on the website.
  const message = () => (m.live ? onSite() : asStudent ? router.push(`/student/chat/${m.id}`) : toast("Sign in as a student to message mentors"));
  const intro = () => (m.live ? WebBrowser.openBrowserAsync(`${SITE}/mentors/${m.id}?intro=1`) : asStudent ? router.push(`/student/book?m=${m.id}&kind=intro`) : toast("Sign in as a student to book a call"));
  const buy = (what: string, price: number) => (m.live ? onSite() : asStudent ? pay(m, what, price) : toast("Sign in as a student to buy hours"));
  const hours: [number, number][] = [[1, m.rate], ...m.bundles];
  const [picked, setPicked] = useState(0);
  useEffect(() => cmp.refresh(m), [m.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrolling to a section from the tabs, and underlining the one on screen.
  const scroll = useRef<ScrollViewInstance>(null);
  const ys = useRef<Record<string, number>>({});
  const tabsY = useRef(0);
  const [on, setOn] = useState("about");

  const knownFor = m.knownFor || [];
  const highlights = m.highlights || [];
  const secs: Sec[] = [];
  if (m.bio || m.clients.length) {
    secs.push({ id: "about", label: "About", body: (
      <>
        <Eyebrow>About {name1}</Eyebrow>
        {knownFor[0] ? <Text style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.5, color: c.ink }}>{knownFor[0]}<Text style={{ color: c.primary }}>.</Text></Text> : null}
        {m.bio ? <Text style={{ fontFamily: fonts.displayRegular, fontSize: 17, lineHeight: 27, color: c.ink }}>{m.bio}</Text> : null}
        {m.clients.length ? <Card tone="tint"><Small>{name1}’s students got into:</Small><SchoolList schools={m.clients} size={30} /></Card> : null}
      </>
    ) });
  }
  if (knownFor.length) {
    const tints = [c.blue, c.tint, c.pinkSoft];
    secs.push({ id: "known", label: "Known for", body: (
      <>
        <SecTitle a={`What ${name1} is `} b="known for" />
        {knownFor.map((k, i) => (
          <View key={k} style={{ backgroundColor: tints[i % 3], borderRadius: 18, padding: 16, gap: 8 }}>
            <Text style={{ fontFamily: fonts.displayRegular, fontStyle: "italic", fontSize: 15, color: c.primary }}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={{ fontFamily: fonts.displayRegular, fontSize: 18, lineHeight: 24, color: c.ink }}>{k}</Text>
          </View>
        ))}
      </>
    ) });
  }
  if (m.specialties.length || m.best.length) {
    secs.push({ id: "specialties", label: "Specialties", body: (
      <>
        <SecTitle a="Specialties" />
        {m.specialties.length ? <><Label>What {name1} helps with</Label><Chips>{m.specialties.map((s) => <Chip key={s} label={s} />)}</Chips></> : null}
        {m.best.length ? <><Label>Best for</Label><Chips>{m.best.map((s) => <Chip key={s} label={s} tone="gray" />)}</Chips></> : null}
      </>
    ) });
  }
  if (m.roles.length || m.stagesLabel) {
    secs.push({ id: "experience", label: "Experience", body: (
      <>
        <SecTitle a="Admissions experience" />
        <View style={{ borderLeftWidth: 2, borderColor: c.avatar, paddingLeft: 16, gap: 12 }}>
          {m.roles.map((r) => {
            const [title, ...rest] = r.split(" · ");
            return (
              <View key={r} style={{ gap: 2 }}>
                <View style={{ position: "absolute", left: -23, top: 5, width: 12, height: 12, borderRadius: 6, backgroundColor: c.primary, borderWidth: 2, borderColor: c.bg }} />
                <TT>{title}</TT>
                {rest.length ? <SS>{rest.join(" · ")}</SS> : null}
              </View>
            );
          })}
          {!m.roles.length ? <SS>No formal admissions role listed.</SS> : null}
        </View>
        {m.stagesLabel ? <Note><Text style={{ fontFamily: fonts.bodySemi, color: c.ink }}>Strongest at: </Text>{m.stagesLabel}</Note> : null}
      </>
    ) });
  }
  if (highlights.length) {
    secs.push({ id: "credentials", label: "Credentials", body: (
      <>
        <SecTitle a="Credentials & " b="highlights" />
        {highlights.map((h) => (
          <View key={h} style={{ flexDirection: "row", gap: 12, backgroundColor: c.wash, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginTop: 6 }} />
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: c.ink }}>{h}</Text>
          </View>
        ))}
      </>
    ) });
  }
  if (m.specialtyInterest || m.research) {
    secs.push({ id: "research", label: "Research", body: (
      <>
        <SecTitle a="Clinical & research" />
        {m.specialtyInterest ? <View style={{ alignSelf: "flex-start", backgroundColor: c.tint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: c.deep }}>Specialty interest: {m.specialtyInterest}</Text></View> : null}
        {m.research ? <ReadMore text={m.research} /> : null}
      </>
    ) });
  }
  if (m.langs || m.fun) {
    secs.push({ id: "more", label: m.langs && m.fun ? "Languages & fun fact" : m.langs ? "Languages" : "Fun fact", body: (
      <>
        {m.langs ? <><SecTitle a="Languages" /><Chips>{m.langs.split(", ").map((l) => <Chip key={l} label={l} tone="gray" />)}</Chips></> : null}
        {m.fun ? (
          <>
            <SecTitle a="Fun fact" />
            <View style={{ borderRadius: 20, padding: 18, overflow: "hidden" }}>
              <HeroGlow id={`fun${m.id}`} />
              <Text style={{ fontFamily: fonts.displayRegular, fontSize: 18, lineHeight: 26, color: c.ink }}>{m.fun}</Text>
            </View>
          </>
        ) : null}
      </>
    ) });
  }
  if (m.pkgs.length) {
    secs.push({ id: "packages", label: "Packages", body: (
      <>
        <SecTitle a={`Packages (${m.pkgs.length})`} />
        {m.pkgs.map(([t, s, p]) => (
          <Card key={t} onPress={() => buy(t, p)}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <TT style={{ flex: 1 }}>{t}</TT>
              <Text style={{ fontFamily: fonts.displayRegular, fontSize: 22, color: c.ink }}>{money(p)}</Text>
            </View>
            <SS numberOfLines={3}>{s}</SS>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.link }}>Details →</Text>
          </Card>
        ))}
      </>
    ) });
  }
  secs.push({ id: "reviews", label: "Reviews", body: (
    <>
      <SecTitle a="Reviews" />
      {liveReviews ? (
        liveReviews.length ? liveReviews.slice(0, 5).map((r) => (
          <Card key={r.id}><Stars>{"★".repeat(r.rating)}</Stars>{r.comment ? <Note ink>“{r.comment}”</Note> : null}<Small>{r.author} · {r.bought}</Small></Card>
        )) : (
          <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: c.avatar, borderRadius: 18, padding: 18, gap: 2 }}>
            <Text style={{ fontFamily: fonts.displayRegular, fontSize: 21, color: c.ink }}>No reviews yet</Text>
            <Note>{name1} is new to MentorsMD.</Note>
          </View>
        )
      ) : (
        <>
          <Card><Stars>★★★★★</Stars><Note ink>“Clear, kind and fast. My statement finally sounded like me.”</Note><Small>Accepted to Emory · Oct 2026</Small></Card>
          <Card><Stars>★★★★★</Stars><Note ink>“The mock MMI was harder than the real one. That was the point.”</Note><Small>Verified order · Sep 2026</Small></Card>
        </>
      )}
      {m.live ? <Btn kind="line" label="Open on mentorsmd.com" onPress={onSite} /> : null}
    </>
  ) });

  const jump = (id: string) => {
    setOn(id);
    scroll.current?.scrollTo({ y: Math.max(0, (ys.current[id] ?? 0) - 56), animated: true });
  };
  const onScroll = (y: number) => {
    let cur = secs[0]?.id;
    for (const s of secs) if ((ys.current[s.id] ?? 1e9) - 140 <= y) cur = s.id;
    if (cur && cur !== on) setOn(cur);
  };
  const place = (id: string) => (e: LayoutChangeEvent) => { ys.current[id] = e.nativeEvent.layout.y; };

  return (
    <SafeAreaView edges={footer ? ["top", "bottom"] : ["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView ref={scroll} stickyHeaderIndices={[1]} scrollEventThrottle={64} onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* 0: header + the "sidebar" card */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14, overflow: "hidden" }}>
          <HeroGlow id={`pf${m.id}`} />
          <Hdr title={m.name} sub={m.stage} />
          {role === "mentor" && !m.live ? <Card tone="tint"><Note>This is how students see your profile.</Note></Card> : null}
          <View style={{ backgroundColor: c.surface, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: c.line }}>
            {m.photo ? (
              <Image source={{ uri: m.photo }} style={{ width: "100%", aspectRatio: 1.15, backgroundColor: c.avatar }} contentFit="cover" accessibilityLabel={m.name} />
            ) : (
              <View style={{ width: "100%", aspectRatio: 1.6, backgroundColor: c.avatar, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.displayRegular, fontSize: 64, color: c.deep }}>{m.init}</Text>
              </View>
            )}
            <View style={{ padding: 18, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 34, lineHeight: 37, letterSpacing: -0.6, color: c.ink }}>{m.name}</Text>
                {!m.reviews ? <View style={{ marginTop: 6 }}><Chip label="New" /></View> : null}
              </View>
              {m.credential ? <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: c.ink }}>{m.credential}</Text> : null}
              {m.school ? (
                <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <SchoolLogo name={m.school} size={28} />
                  <View style={{ flex: 1 }}>
                    <TT>{m.school}</TT>
                    {m.stage ? <SS>{m.stage}</SS> : null}
                  </View>
                </View>
              ) : null}
              {m.rating != null ? <Stars>★ {m.rating.toFixed(1)} · {m.reviews} reviews</Stars> : null}
              {m.best.length ? <><Label>Best for</Label><Chips>{m.best.map((s) => <Chip key={s} label={s} tone="gray" />)}</Chips></> : null}

              <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 12, gap: 10, marginTop: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Text style={{ fontFamily: fonts.displayRegular, fontSize: 28, color: c.ink }}>{money(m.rate)}<Text style={{ fontFamily: fonts.body, fontSize: 14, color: c.muted }}>/hr</Text></Text>
                  <Small>{hours.length > 1 ? "Save with bundles" : "Calls and written work"}</Small>
                </View>
                {hours.length > 1 ? (
                  <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="radiogroup">
                    {hours.map(([h, p], i) => (
                      <Pressable key={h} accessibilityRole="radio" accessibilityState={{ selected: picked === i }} onPress={() => setPicked(i)}
                        style={{ flex: 1, borderWidth: 1.5, borderColor: picked === i ? c.primary : c.line, backgroundColor: picked === i ? c.tintSoft : c.surface, borderRadius: 12, paddingVertical: 8, alignItems: "center", gap: 1 }}>
                        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink }}>{h} hr{h === 1 ? "" : "s"}</Text>
                        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.ink }}>{money(p)}</Text>
                        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.muted }}>{money(p / h)}/hr</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Btn kind="line" label={`Buy ${hours[picked][0]} hour${hours[picked][0] === 1 ? "" : "s"} · ${money(hours[picked][1])}`} onPress={() => buy(`${hours[picked][0]} hour${hours[picked][0] === 1 ? "" : "s"}`, hours[picked][1])} />
              </View>

              <Btn kind="dark" icon="video" label="Book free 15-min intro call" onPress={intro} />
              <Btn kind="line" label={`Message ${name1}`} onPress={message} />
              <View style={{ alignItems: "center" }}><CompareTick m={m} label="Add to compare" /></View>
              {m.live ? <Small style={{ textAlign: "center" }}>Booking and messaging open the website for now.</Small> : null}
            </View>
            <View style={{ flexDirection: "row", gap: 10, padding: 14, backgroundColor: c.tintSoft, borderTopWidth: 1, borderColor: c.line }}>
              <Icon name="lock" size={16} color={c.primary} />
              <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: c.muted }}>
                <Text style={{ fontFamily: fonts.bodySemi, color: c.ink }}>Secure payment, every hour logged. </Text>
                When {name1} marks work complete, you have 48 hours to approve it or ask for one last call or revision.
              </Text>
            </View>
          </View>
        </View>

        {/* 1: section tabs (stay at the top) */}
        <View style={{ backgroundColor: c.bg, borderBottomWidth: 1, borderColor: c.line }} onLayout={(e) => { tabsY.current = e.nativeEvent.layout.y; }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {secs.map((s) => (
              <Pressable key={s.id} accessibilityRole="tab" accessibilityState={{ selected: on === s.id }} onPress={() => jump(s.id)}
                style={{ paddingHorizontal: 10, paddingVertical: 13, borderBottomWidth: 2, borderColor: on === s.id ? c.primary : "transparent" }}>
                <Text style={{ fontFamily: on === s.id ? fonts.bodySemi : fonts.bodyMedium, fontSize: 14, color: on === s.id ? c.ink : c.muted }}>{s.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* 2…: the sections */}
        {secs.map((s, i) => (
          <View key={s.id} onLayout={place(s.id)} style={{ paddingHorizontal: 20, paddingVertical: 24, gap: 12, borderBottomWidth: i === secs.length - 1 ? 0 : 1, borderColor: c.line }}>
            {s.body}
          </View>
        ))}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, backgroundColor: c.bg, borderTopWidth: 1, borderColor: c.line }}>{footer}</View> : null}
    </SafeAreaView>
  );
}

function SecTitle({ a, b }: { a: string; b?: string }) {
  const c = useColors();
  return (
    <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, color: c.ink }}>
      {a}{b ? <Text style={{ fontStyle: "italic", color: c.primary }}>{b}</Text> : null}
    </Text>
  );
}

function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.3, textTransform: "uppercase", color: c.faint }}>{children}</Text>;
}

function ReadMore({ text }: { text: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <View style={{ gap: 6 }}>
      <Text numberOfLines={open || !long ? undefined : 6} style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: c.muted }}>{text}</Text>
      {long ? <Pressable accessibilityRole="button" onPress={() => setOpen((o) => !o)} hitSlop={8}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.link }}>{open ? "Show less" : "Read more"}</Text></Pressable> : null}
    </View>
  );
}
