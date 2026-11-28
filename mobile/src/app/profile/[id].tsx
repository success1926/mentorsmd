import * as WebBrowser from "expo-web-browser";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CompareTick, HeroGlow, useCompareFooter } from "../../components/brand";
import { liveCache } from "../../components/find";
import { usePaySheet } from "../../components/shared";
import { useSafetySheet } from "../../components/safety";
import { Btn, Card, Chip, Chips, H, Hdr, Icon, Link, Loading, Note, Price, ReadMore, RowV, SchoolList, SchoolLogo, Screen, Small, SS, Stars, TT } from "../../components/ui";
import { api, dollars, errorText, useApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useOverlay } from "../../lib/overlay";
import { type LiveOffer, liveProfile, type LiveReview, type Mentor, SITE, useLoad } from "../../lib/live";
import { useCompare } from "../../lib/match";
import { fonts, useColors } from "../../lib/theme";
import { firstName, fmtDateTime, money } from "../../lib/format";

// A mentor's profile (Nov 27 2026, the website's badge profile as it looks
// on a phone): a small "hospital badge" (photo + school logo) with the name,
// school and rating beside it, then the bio, quick facts and schools their
// students got into. Then the prices in order: hourly (with the intro call,
// Message and Buy 1 hour), hour packs, then bigger packages as ticket stubs.
// Then section tabs that stay at the top while you scroll, then the
// sections. Loaded from mentorsmd.com.
// Signed-in students message, book the free intro call and buy right here
// (buying unlocks once the mentor replies or after the intro call, as on
// the website); visitors are sent to sign in.
export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LiveProfile id={id} />;
}

type Loaded = Awaited<ReturnType<typeof liveProfile>>;

function LiveProfile({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => liveProfile(id), [id]);
  const card = liveCache.get(id);
  if (data)
    return (
      <ProfileView
        m={{ ...data.mentor, specialties: data.mentor.specialties.length ? data.mentor.specialties : card?.specialties || [], rating: card?.rating ?? data.mentor.rating }}
        liveReviews={data.reviews}
        offers={data.offers}
        seller={data.seller}
      />
    );
  return (
    <Screen>
      <Hdr title={card?.name || "Mentor"} sub={card?.stage} />
      {loading ? <Loading label="Loading the profile" /> : null}
      {error ? <Card tone="warn"><TT>Couldn’t load this profile</TT><Note>{error}</Note><Btn kind="line" label="Try again" onPress={reload} /></Card> : null}
    </Screen>
  );
}

type Sec = { id: string; label: string; body: ReactNode };
type Unlock = { unlocked: boolean; messaged: boolean; conversationId: string | null; introCall: { id: string; startTime: string; status: string } | null; canBookIntro: boolean; introBlockedReason: string | null };

function ProfileView({ m, liveReviews, offers, seller }: { m: Mentor; liveReviews: LiveReview[]; offers: Loaded["offers"]; seller: Loaded["seller"] }) {
  const c = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { toast, openSheet, closeSheet } = useOverlay();
  const pay = usePaySheet();
  const safety = useSafetySheet();
  const footer = useCompareFooter();
  const cmp = useCompare();
  const name1 = firstName(m.name);
  const onSite = () => WebBrowser.openBrowserAsync(`${SITE}/mentors/${m.id}`);
  const isStudent = user?.role === "BUYER";
  const isMe = !!user && user.id === m.id;
  const unlock = useApi<Unlock>(isStudent ? `/api/mentors/${encodeURIComponent(m.id)}/unlock` : null);
  const blocks = useApi<{ iBlocked: boolean; theyBlocked: boolean }>(isStudent ? `/api/blocks?userId=${encodeURIComponent(m.id)}` : null);
  const [busy, setBusy] = useState(false);
  const blockedNote = blocks.data?.iBlocked ? `You blocked ${name1}. Unblock them to book or buy.` : blocks.data?.theyBlocked ? `You can’t book with ${name1}.` : "";
  const canTake = seller.listed && !seller.adultsOnlyForViewer;
  const unlocked = !!unlock.data?.unlocked;
  const notStudent = () => {
    if (!user) {
      toast("Sign in with a student account first");
      router.push("/");
    } else toast(isMe ? "This is how students see your profile" : "Only student accounts can message, book or buy");
  };
  const message = async () => {
    if (!isStudent) return notStudent();
    if (blockedNote) return toast(blockedNote);
    setBusy(true);
    try {
      const r = await api<{ conversation: { id: string } }>("/api/conversations", { body: { sellerId: m.id } });
      router.push(`/student/chat/${r.conversation.id}`);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const intro = () => {
    if (!isStudent) return notStudent();
    if (blockedNote) return toast(blockedNote);
    const booked = unlock.data?.introCall;
    if (booked && booked.status === "BOOKED") return router.push("/student/calendar");
    if (unlock.data && !unlock.data.canBookIntro) return toast(unlock.data.introBlockedReason || `You’ve already had your intro call with ${name1}.`);
    router.push(`/student/book?m=${encodeURIComponent(m.id)}&kind=intro&name=${encodeURIComponent(m.name)}`);
  };
  const buy = (o: LiveOffer, title: string) => {
    if (!isStudent) return notStudent();
    if (blockedNote) return toast(blockedNote);
    if (!canTake) return toast(seller.adultsOnlyForViewer ? `${name1} works with students 18 and over.` : `${name1} isn’t taking new orders right now.`);
    if (unlock.loading && !unlock.data) return;
    if (!unlocked) return toast(`Buying unlocks once ${name1} replies to your message, or after your free intro call.`);
    pay({ what: { type: "offer", gigId: o.id }, title, mentorName: m.name, priceCents: o.price });
  };
  const hrs = (o: LiveOffer) => Math.round((o.minutes / 60) * 10) / 10;
  const hrsLabel = (o: LiveOffer) => `${hrs(o)} hour${hrs(o) === 1 ? "" : "s"}`;
  const hoursTitle = (o: LiveOffer) => `${hrsLabel(o)} with ${name1}`;
  const packs = [...offers.bundles].sort((x, y) => x.minutes - y.minutes);
  const hourlyRate = offers.hourly?.rateCents || 0;
  const saveOf = (o: LiveOffer) => (hourlyRate && o.rateCents && o.rateCents < hourlyRate ? Math.round((1 - o.rateCents / hourlyRate) * 100) : 0);
  const PACKAGES_SHOWN = 3;
  const tickets = [c.tint, c.blue, c.pinkSoft];
  // A bigger package's details, with its Buy button, in a bottom sheet.
  const showPackage = (o: LiveOffer) => openSheet(() => (
    <>
      <RowV style={{ justifyContent: "space-between", alignItems: "flex-start" }}><H style={{ flex: 1 }}>{o.title}</H><Price>{dollars(o.price)}</Price></RowV>
      <Small>About {hrsLabel(o)}{o.rateCents ? ` · ${dollars(o.rateCents)}/hr` : ""} · calls + written work</Small>
      {o.description ? <ReadMore text={o.description} /> : null}
      {!isMe ? <Btn kind="dark" label={isStudent && unlocked ? `Buy for ${dollars(o.price)}` : "Buy this package"} onPress={() => { closeSheet(); buy(o, o.title); }} /> : null}
      <Btn kind="line" label="Close" onPress={closeSheet} />
      <Small>The hours are an estimate: if it takes longer, you add hours at the same rate. Unused hours aren’t refunded if you finish early.</Small>
    </>
  ));
  const allPackages = () => openSheet(() => (
    <>
      <H>{name1}’s packages ({offers.packages.length})</H>
      {offers.packages.map((o) => (
        <Pressable key={o.id} accessibilityRole="button" onPress={() => showPackage(o)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line, minHeight: 44 }}>
          <View style={{ flex: 1 }}><TT>{o.title}</TT><Small>About {hrsLabel(o)}</Small></View>
          <TT>{dollars(o.price)} →</TT>
        </Pressable>
      ))}
      <Btn kind="line" label="Close" onPress={closeSheet} />
    </>
  ));
  const facts = [
    ...(m.yearsAdvising ? [{ value: `${m.yearsAdvising}+`, label: m.yearsAdvising === 1 ? "year advising" : "years advising" }] : []),
    ...(m.applicantsSupported ? [{ value: `${m.applicantsSupported}+`, label: "applicants helped" }] : []),
    ...(m.roles.length ? [{ value: String(m.roles.length), label: m.roles.length === 1 ? "admissions role" : "admissions roles" }] : []),
    ...(m.clients.length ? [{ value: String(m.clients.length), label: m.clients.length === 1 ? "school students got into" : "schools students got into" }] : []),
    ...(m.reviews && m.rating != null ? [{ value: `${m.rating.toFixed(1)}★`, label: `${m.reviews} ${m.reviews === 1 ? "review" : "reviews"}` }] : []),
  ].slice(0, 4);
  useEffect(() => cmp.refresh(m), [m.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrolling to a section from the tabs, and underlining the one on screen.
  const scroll = useRef<ScrollViewInstance>(null);
  const ys = useRef<Record<string, number>>({});
  const tabsY = useRef(0);
  const [on, setOn] = useState("");

  const knownFor = m.knownFor || [];
  const highlights = m.highlights || [];
  const secs: Sec[] = [];
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
  secs.push({ id: "reviews", label: "Reviews", body: (
    <>
      <SecTitle a="Reviews" />
      {liveReviews.length ? liveReviews.slice(0, 5).map((r) => (
        <Card key={r.id}><Stars>{"★".repeat(r.rating)}</Stars>{r.comment ? <Note ink>“{r.comment}”</Note> : null}<Small>{r.author} · {r.bought}</Small></Card>
      )) : (
        <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: c.avatar, borderRadius: 18, padding: 18, gap: 2 }}>
          <Text style={{ fontFamily: fonts.displayRegular, fontSize: 21, color: c.ink }}>No reviews yet</Text>
          <Note>{name1} is new to MentorsMD.</Note>
        </View>
      )}
      {m.live ? <Btn kind="line" label="Open on mentorsmd.com" onPress={onSite} /> : null}
    </>
  ) });

  const jump = (id: string) => {
    setOn(id);
    scroll.current?.scrollTo({ y: Math.max(0, (ys.current[id] ?? 0) - 56), animated: true });
  };
  const onScroll = (y: number) => {
    let cur = y + 140 < (ys.current[secs[0]?.id] ?? 0) ? "" : secs[0]?.id;
    for (const s of secs) if ((ys.current[s.id] ?? 1e9) - 140 <= y) cur = s.id;
    if (cur && cur !== on) setOn(cur);
  };
  const place = (id: string) => (e: LayoutChangeEvent) => { ys.current[id] = e.nativeEvent.layout.y; };

  return (
    <SafeAreaView edges={footer ? ["top", "bottom"] : ["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView ref={scroll} stickyHeaderIndices={[1]} scrollEventThrottle={64} onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* 0: header, the badge with the person beside it, bio, then prices */}
        <View>
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16, overflow: "hidden" }}>
            <HeroGlow id={`pf${m.id}`} />
            <Hdr title={m.name} sub={m.stage} />
            {isMe ? <Card tone="tint"><Note>This is how students see your profile.</Note></Card> : null}
            {!seller.available ? <Card tone="warn"><Note>{name1} is away right now. New orders are paused.</Note></Card> : null}

            <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
              {/* The badge: lanyard clip, strip, photo with the school logo, name */}
              <View style={{ width: 150, alignItems: "center" }} accessible accessibilityLabel={`${m.name}'s MentorsMD badge`}>
                <View style={{ width: 28, height: 22, backgroundColor: c.primary, alignItems: "center", justifyContent: "flex-end" }}>
                  <View style={{ width: 20, height: 12, marginBottom: -6, borderWidth: 3, borderBottomWidth: 0, borderColor: "#A7A3B8", borderTopLeftRadius: 9, borderTopRightRadius: 9, backgroundColor: c.surface }} />
                </View>
                <View style={{ width: "100%", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, overflow: "hidden", transform: [{ rotate: "-1.5deg" }], shadowColor: "#3F24B0", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 4 }}>
                  <View style={{ backgroundColor: "#5536D6", paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: "#FFFFFF" }}>MentorsMD</Text>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 8.5, letterSpacing: 1.2, color: "#FFFFFF" }}>MENTOR</Text>
                  </View>
                  <View style={{ width: "100%", aspectRatio: 1, backgroundColor: c.avatar }}>
                    {m.photo ? (
                      <Image source={{ uri: m.photo }} style={{ width: "100%", height: "100%" }} contentFit="cover" accessibilityLabel={m.name} />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontFamily: fonts.displayRegular, fontSize: 48, color: c.deep }}>{m.init}</Text>
                      </View>
                    )}
                    {m.school ? (
                      <View style={{ position: "absolute", right: 7, bottom: 7, padding: 4, borderRadius: 12, backgroundColor: "#FFFFFF", shadowColor: "#1B1834", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
                        <SchoolLogo name={m.school} size={36} logo={m.logos?.[m.school]} />
                      </View>
                    ) : null}
                  </View>
                  <View style={{ borderTopWidth: 1, borderStyle: "dashed", borderColor: c.line, paddingHorizontal: 10, paddingVertical: 7 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: c.ink }}>{m.name}</Text>
                  </View>
                </View>
              </View>

              {/* The person, beside the badge */}
              <View style={{ flex: 1, minWidth: 0, gap: 6, paddingTop: 20 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.5, color: c.ink }}>{m.name}</Text>
                {!m.reviews ? <View style={{ alignSelf: "flex-start" }}><Chip label="New" /></View> : null}
                {m.credential ? <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18, color: c.ink }}>{m.credential}</Text> : null}
                {m.school ? (
                  <View>
                    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, lineHeight: 18, color: c.ink }}>{m.school}</Text>
                    {m.stage ? <Text style={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: c.muted }}>{m.stage}</Text> : null}
                  </View>
                ) : null}
                {m.rating != null ? <Stars>★ {m.rating.toFixed(1)} · {m.reviews} {m.reviews === 1 ? "review" : "reviews"}</Stars> : null}
              </View>
            </View>

            {m.best.length ? <Chips>{m.best.map((s) => <Chip key={s} label={s} tone="gray" />)}</Chips> : null}
            {knownFor[0] ? <Text style={{ fontFamily: fonts.display, fontSize: 25, lineHeight: 29, letterSpacing: -0.4, color: c.ink }}>{knownFor[0]}<Text style={{ color: c.primary }}>.</Text></Text> : null}
            {m.bio ? <ReadMore text={m.bio} /> : null}
            {facts.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {facts.map((f) => (
                  <View key={f.label} style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: fonts.displayRegular, fontSize: 24, lineHeight: 28, color: c.ink }}>{f.value}</Text>
                    <Text style={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: c.muted }}>{f.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {m.clients.length ? <Card><Small>{name1}’s students got into:</Small><SchoolList schools={m.clients} size={30} logos={m.logos} /></Card> : null}
          </View>

          {/* Prices: hourly, hour packs, then bigger packages */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 22, gap: 20 }}>
            <View style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 18, gap: 10, shadowColor: "#1B1834", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 }}>
              {m.rate ? (
                <View style={{ gap: 2, marginBottom: 4 }}>
                  <Label>Hourly</Label>
                  <Text style={{ fontFamily: fonts.displayRegular, fontSize: 44, lineHeight: 50, color: c.ink }}>{money(m.rate)}<Text style={{ fontFamily: fonts.body, fontSize: 16, color: c.muted }}> / hour</Text></Text>
                  <Small>Calls and written work</Small>
                </View>
              ) : null}
              {!isMe ? (
                <>
                  <Btn kind="line" icon="video" label={unlock.data?.introCall?.status === "BOOKED" ? "Intro call booked · see calendar" : "Book free 15-min intro call"} disabled={!canTake && isStudent} onPress={intro} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}><Btn kind="line" label={busy ? "Opening…" : `Message ${name1}`} disabled={busy || (isStudent && (!seller.available || seller.adultsOnlyForViewer))} onPress={message} /></View>
                    {offers.hourly ? <View style={{ flex: 1 }}><Btn kind="dark" label="Buy 1 hour" onPress={() => buy(offers.hourly!, hoursTitle(offers.hourly!))} /></View> : null}
                  </View>
                </>
              ) : null}
              {isStudent ? <UnlockNote unlock={unlock.data} first={name1} blockedNote={blockedNote} adultsOnly={seller.adultsOnlyForViewer} /> : null}
              {!user ? <Small style={{ textAlign: "center" }}>Sign in with a student account to message, book or buy.</Small> : null}
            </View>

            {packs.length ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: c.ink }}>Hour packs <Text style={{ fontFamily: fonts.body, color: c.muted }}>· calls or written work</Text></Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {packs.map((o) => (
                    <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={`${hrsLabel(o)} for ${dollars(o.price)}`} onPress={() => buy(o, hoursTitle(o))}
                      style={({ pressed }) => ({ flexGrow: 1, flexBasis: "30%", minWidth: 0, backgroundColor: pressed ? c.tintSoft : c.surface, borderWidth: 1.5, borderColor: pressed ? c.primary : c.line, borderRadius: 14, padding: 12, gap: 1 })}>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: c.ink }}>{hrsLabel(o)}</Text>
                      <Text style={{ fontFamily: fonts.displayRegular, fontSize: 24, lineHeight: 28, color: c.ink }}>{dollars(o.price)}</Text>
                      <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: c.muted }}>{dollars(o.rateCents || Math.round(o.price / hrs(o)))}/hr{saveOf(o) ? ` · save ${saveOf(o)}%` : ""}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {offers.packages.length ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: c.ink }}>Bigger packages <Text style={{ fontFamily: fonts.body, color: c.muted }}>· a set plan, a finished result</Text></Text>
                {offers.packages.slice(0, PACKAGES_SHOWN).map((o, i) => (
                  <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={`${o.title}, ${dollars(o.price)}`} onPress={() => showPackage(o)}
                    style={({ pressed }) => ({ flexDirection: "row", backgroundColor: c.surface, borderWidth: 1, borderColor: pressed ? c.primary : c.line, borderRadius: 14, overflow: "hidden", minHeight: 64 })}>
                    <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 12, gap: 2 }}>
                      <TT>{o.title}</TT>
                      <Small>About {hrsLabel(o)} · calls + written</Small>
                    </View>
                    <View style={{ width: 88, backgroundColor: tickets[i % 3], borderLeftWidth: 2, borderStyle: "dashed", borderColor: c.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                      <Text style={{ fontFamily: fonts.displayRegular, fontSize: 21, color: c.ink }}>{dollars(o.price)}</Text>
                    </View>
                  </Pressable>
                ))}
                {offers.packages.length > PACKAGES_SHOWN ? <Link label={`See all ${offers.packages.length} packages →`} onPress={allPackages} /> : null}
              </View>
            ) : null}

            {!offers.hourly && !packs.length && !offers.packages.length ? <Note>{name1} hasn’t set up their hours yet. You can still message them.</Note> : null}

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Icon name="lock" size={16} color={c.primary} />
              <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: c.muted }}>
                <Text style={{ fontFamily: fonts.bodySemi, color: c.ink }}>Secure payment, every hour logged. </Text>
                When {name1} marks work complete, you have 48 hours to approve it or ask for one last call or revision.
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <CompareTick m={m} label="Add to compare" />
              {isStudent ? <Link label={`Report or block ${name1}`} onPress={() => safety({ userId: m.id, name: m.name }, () => blocks.reload())} /> : null}
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

function UnlockNote({ unlock, first, blockedNote, adultsOnly }: { unlock: Unlock | null; first: string; blockedNote: string; adultsOnly: boolean }) {
  if (blockedNote) return <Small style={{ textAlign: "center" }}>{blockedNote}</Small>;
  if (adultsOnly) return <Small style={{ textAlign: "center" }}>{first} works with students 18 and over. Please choose another mentor.</Small>;
  if (!unlock) return null;
  if (unlock.unlocked) return <Small style={{ textAlign: "center" }}>Unlocked. You can buy hours and packages from {first}.</Small>;
  const intro = unlock.introCall;
  return (
    <Small style={{ textAlign: "center" }}>
      {intro && intro.status === "BOOKED"
        ? `Intro call booked for ${fmtDateTime(intro.startTime)}. Buying unlocks once it’s held, or when ${first} replies to a message.`
        : unlock.messaged
          ? `Waiting for ${first} to reply. Buying unlocks once they do, or after an intro call.`
          : `Buying unlocks once ${first} replies to a message, or after your intro call.`}
    </Small>
  );
}
