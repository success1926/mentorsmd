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
import { Btn, Card, Chip, Chips, Eyebrow, Hdr, Icon, Link, Loading, Note, ReadMore, SchoolList, SchoolLogo, Screen, Small, SS, Stars, TT } from "../../components/ui";
import { api, dollars, errorText, useApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useOverlay } from "../../lib/overlay";
import { type LiveOffer, liveProfile, type LiveReview, type Mentor, SITE, useLoad } from "../../lib/live";
import { useCompare } from "../../lib/match";
import { fonts, useColors } from "../../lib/theme";
import { firstName, fmtDateTime, money } from "../../lib/format";

// A mentor's profile (Nov 2026, the website's sticky-sidebar profile as it
// looks on a phone): the card with photo, school, who they're best for,
// rate and the two main buttons on top, then section tabs that stay at the
// top while you scroll, then the sections. Loaded from mentorsmd.com.
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
  const { toast } = useOverlay();
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
  const hourOffers = [...(offers.hourly ? [offers.hourly] : []), ...offers.bundles].sort((x, y) => x.minutes - y.minutes);
  const hrs = (o: LiveOffer) => Math.round((o.minutes / 60) * 10) / 10;
  const hoursTitle = (o: LiveOffer) => `${hrs(o)} hour${hrs(o) === 1 ? "" : "s"} with ${name1}`;
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
        {m.clients.length ? <Card tone="tint"><Small>{name1}’s students got into:</Small><SchoolList schools={m.clients} size={30} logos={m.logos} /></Card> : null}
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
  if (offers.packages.length) {
    secs.push({ id: "packages", label: "Packages", body: (
      <>
        <SecTitle a={`Packages (${offers.packages.length})`} />
        {offers.packages.map((o) => (
          <Card key={o.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <TT style={{ flex: 1 }}>{o.title}</TT>
              <Text style={{ fontFamily: fonts.displayRegular, fontSize: 22, color: c.ink }}>{dollars(o.price)}</Text>
            </View>
            <Small>About {hrs(o)} hour{hrs(o) === 1 ? "" : "s"}{o.rateCents ? ` · ${dollars(o.rateCents)}/hr` : ""}</Small>
            {o.description ? <ReadMore text={o.description} /> : null}
            {!isMe ? <Btn kind="line" sm label={isStudent && unlocked ? `Buy for ${dollars(o.price)}` : "Buy this package"} onPress={() => buy(o, o.title)} /> : null}
          </Card>
        ))}
        <Small>The hours are an estimate: if it takes longer, you add hours at the same rate. Unused hours aren’t refunded if you finish early.</Small>
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
          {isMe ? <Card tone="tint"><Note>This is how students see your profile.</Note></Card> : null}
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
                  <SchoolLogo name={m.school} size={28} logo={m.logos?.[m.school]} />
                  <View style={{ flex: 1 }}>
                    <TT>{m.school}</TT>
                    {m.stage ? <SS>{m.stage}</SS> : null}
                  </View>
                </View>
              ) : null}
              {m.rating != null ? <Stars>★ {m.rating.toFixed(1)} · {m.reviews} {m.reviews === 1 ? "review" : "reviews"}</Stars> : null}
              {m.best.length ? <><Label>Best for</Label><Chips>{m.best.map((s) => <Chip key={s} label={s} tone="gray" />)}</Chips></> : null}

              <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 12, gap: 10, marginTop: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Text style={{ fontFamily: fonts.displayRegular, fontSize: 28, color: c.ink }}>{money(m.rate)}<Text style={{ fontFamily: fonts.body, fontSize: 14, color: c.muted }}>/hr</Text></Text>
                  <Small>{hourOffers.length > 1 ? "Save with bundles" : "Calls and written work"}</Small>
                </View>
                {hourOffers.length > 1 ? (
                  <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="radiogroup">
                    {hourOffers.map((o, i) => (
                      <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: picked === i }} onPress={() => setPicked(i)}
                        style={{ flex: 1, borderWidth: 1.5, borderColor: picked === i ? c.primary : c.line, backgroundColor: picked === i ? c.tintSoft : c.surface, borderRadius: 12, paddingVertical: 8, alignItems: "center", gap: 1 }}>
                        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink }}>{hrs(o)} hr{hrs(o) === 1 ? "" : "s"}</Text>
                        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.ink }}>{dollars(o.price)}</Text>
                        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.muted }}>{dollars(Math.round(o.price / hrs(o)))}/hr</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {hourOffers.length && !isMe ? (
                  <Btn kind="line" label={`Buy ${hrs(hourOffers[Math.min(picked, hourOffers.length - 1)])} hour${hrs(hourOffers[Math.min(picked, hourOffers.length - 1)]) === 1 ? "" : "s"} · ${dollars(hourOffers[Math.min(picked, hourOffers.length - 1)].price)}`}
                    onPress={() => { const o = hourOffers[Math.min(picked, hourOffers.length - 1)]; buy(o, hoursTitle(o)); }} />
                ) : null}
              </View>

              {!isMe ? (
                <>
                  <Btn kind="dark" icon="video" label={unlock.data?.introCall?.status === "BOOKED" ? "Intro call booked · see calendar" : "Book free 15-min intro call"} disabled={!canTake && isStudent} onPress={intro} />
                  <Btn kind="line" label={busy ? "Opening…" : `Message ${name1}`} disabled={busy || (isStudent && (!seller.available || seller.adultsOnlyForViewer))} onPress={message} />
                </>
              ) : null}
              <View style={{ alignItems: "center" }}><CompareTick m={m} label="Add to compare" /></View>
              {isStudent ? <UnlockNote unlock={unlock.data} first={name1} blockedNote={blockedNote} adultsOnly={seller.adultsOnlyForViewer} /> : null}
              {!user ? <Small style={{ textAlign: "center" }}>Sign in with a student account to message, book or buy.</Small> : null}
              {isStudent ? <Link label={`Report or block ${name1}`} style={{ alignSelf: "center" }} onPress={() => safety({ userId: m.id, name: m.name }, () => blocks.reload())} /> : null}
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
