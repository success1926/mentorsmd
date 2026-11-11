import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { liveCache } from "../../components/find";
import { usePaySheet } from "../../components/shared";
import { Av, Btn, Btns2, Card, Chip, Chips, Eyebrow, Grow, H, Half, Hdr, KV, Loading, Note, Price, Row, RowV, SchoolList, SchoolLogo, Screen, Sec, SecH, Small, SS, Stars, TT } from "../../components/ui";
import { useDemo, useOverlay } from "../../lib/demo";
import { liveProfile, SITE, useLoad, type LiveReview } from "../../lib/live";
import { first, money, sampleMentor, type Mentor } from "../../lib/sample";
import { fonts, useColors } from "../../lib/theme";

// A mentor's profile, laid out like the website (Leland style). Sample
// mentors come from the preview data; real ones load from mentorsmd.com.
export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sample = sampleMentor(id);
  if (sample) return <ProfileView m={sample} />;
  return <LiveProfile id={id} />;
}

function LiveProfile({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => liveProfile(id), [id]);
  const card = liveCache.get(id);
  if (data) return <ProfileView m={{ ...data.mentor, specialties: card?.specialties || data.mentor.specialties, rating: card?.rating ?? data.mentor.rating }} liveReviews={data.reviews} />;
  return (
    <Screen>
      <Hdr title={card?.name || "Mentor"} sub={card?.stage} />
      {loading ? <Loading label="Loading the profile from mentorsmd.com" /> : null}
      {error ? <Card tone="warn"><TT>Couldn’t load this profile</TT><Note>{error}</Note><Btn kind="line" label="Try again" onPress={reload} /></Card> : null}
    </Screen>
  );
}

function ProfileView({ m, liveReviews }: { m: Mentor; liveReviews?: LiveReview[] }) {
  const c = useColors();
  const router = useRouter();
  const { role } = useDemo();
  const { toast } = useOverlay();
  const pay = usePaySheet();
  const name1 = first(m.name);
  const onSite = () => WebBrowser.openBrowserAsync(`${SITE}/mentors/${m.id}`);
  const asStudent = role === "student";
  // What the buttons do: sample mentors work inside the preview for students;
  // real mentors open their page on the website.
  const message = () => (m.live ? onSite() : asStudent ? router.push(`/student/chat/${m.id}`) : toast("Sign in as a student to message mentors"));
  const intro = () => (m.live ? onSite() : asStudent ? router.push(`/student/book?m=${m.id}&kind=intro`) : toast("Sign in as a student to book a call"));
  const buy = (what: string, price: number) => (m.live ? onSite() : asStudent ? pay(m, what, price) : toast("Sign in as a student to buy hours"));
  const offers: [number, number][] = [[1, m.rate], ...m.bundles];
  return (
    <Screen>
      <Hdr title={m.name} sub={m.stage} />
      {role === "mentor" && !m.live ? <Card tone="tint"><Note>This is how students see your profile.</Note></Card> : null}
      <RowV gap={14}>
        <Av init={m.init} photo={m.photo} size={88} />
        <Grow gap={4}>
          <H>{m.name}</H>
          {m.stage ? <SS style={{ color: c.ink, fontFamily: fonts.bodySemi }}>{m.stage}</SS> : null}
          {m.school ? <RowV gap={8}><SchoolLogo name={m.school} size={24} /><SS style={{ flexShrink: 1 }}>{m.school}</SS></RowV> : null}
          {m.rating != null ? <Stars>★ {m.rating.toFixed(1)} · {m.reviews} reviews</Stars> : <Small>New on MentorsMD</Small>}
        </Grow>
      </RowV>
      <Btns2>
        <Half><Btn kind="dark" label="Message" onPress={message} /></Half>
        <Half><Btn kind="line" label="Free 15-min call" onPress={intro} /></Half>
      </Btns2>
      <Small>{m.reply ? `${m.reply}. ` : ""}Messaging is free.{m.live ? " These open the website for now." : ""}</Small>

      {m.bio ? <Sec><Eyebrow>About {name1}</Eyebrow><Note ink>{m.bio}</Note></Sec> : null}
      {m.highlights?.length ? <Sec><Eyebrow>Highlights</Eyebrow>{m.highlights.map((h) => <Note ink key={h}>•  {h}</Note>)}</Sec> : null}
      {m.knownFor?.length ? <Sec><Eyebrow>Known for</Eyebrow><Chips>{m.knownFor.map((s) => <Chip key={s} label={s} tone="gray" />)}</Chips></Sec> : null}
      {m.specialties.length ? <Sec><Eyebrow>Specialties</Eyebrow><Chips>{m.specialties.map((s) => <Chip key={s} label={s} />)}</Chips></Sec> : null}
      {m.best.length ? <Sec><Eyebrow>Best for</Eyebrow><Chips>{m.best.map((s) => <Chip key={s} label={s} tone="gray" />)}</Chips></Sec> : null}
      {m.clients.length ? <Sec><Eyebrow>Successful clients at</Eyebrow><SchoolList schools={m.clients} size={26} /></Sec> : null}

      <Sec>
        <SecH><Eyebrow>Buy hours</Eyebrow><Price>{money(m.rate)}/hr</Price></SecH>
        <Small>Use hours for calls or written work on anything {name1} offers. Every hour is logged on your package page.</Small>
        <View>
          {offers.map(([h, p], i) => (
            <Row key={h} tt={`${h} hour${h === 1 ? "" : "s"}`} ss={`${money(p / h)} an hour`} rr={<Price>{money(p)}</Price>} last={i === offers.length - 1}
              onPress={() => buy(`${h} hour${h === 1 ? "" : "s"}`, p)} />
          ))}
        </View>
      </Sec>
      {m.pkgs.length ? (
        <Sec>
          <Eyebrow>Specialized packages</Eyebrow>
          {m.pkgs.map(([t, s, p]) => (
            <Card key={t} onPress={() => buy(t, p)}>
              <RowV style={{ justifyContent: "space-between" }}><TT style={{ flex: 1 }}>{t}</TT><Price>{money(p)}</Price></RowV>
              <SS numberOfLines={3}>{s}</SS>
            </Card>
          ))}
        </Sec>
      ) : null}

      {m.roles.length || m.bg.length || m.langs || m.fun ? (
        <Sec>
          <Eyebrow>Experience</Eyebrow>
          <View>
            {m.roles.length ? <KV k="Admissions roles" v={m.roles.join(", ")} /> : null}
            {m.bg.length ? <KV k="Background" v={m.bg.join(", ")} /> : null}
            {m.langs ? <KV k="Languages" v={m.langs} /> : null}
            {m.fun ? <KV k="Fun fact" v={m.fun} /> : null}
          </View>
        </Sec>
      ) : null}

      <Sec>
        <Eyebrow>Reviews</Eyebrow>
        {liveReviews ? (
          liveReviews.length ? liveReviews.slice(0, 5).map((r) => (
            <Card key={r.id}><Stars>{"★".repeat(r.rating)}</Stars>{r.comment ? <Note ink>“{r.comment}”</Note> : null}<Small>{r.author} · {r.bought}</Small></Card>
          )) : <Note>No reviews yet.</Note>
        ) : (
          <>
            <Card><Stars>★★★★★</Stars><Note ink>“Clear, kind and fast. My statement finally sounded like me.”</Note><Small>Accepted to Emory · Oct 2026</Small></Card>
            <Card><Stars>★★★★★</Stars><Note ink>“The mock MMI was harder than the real one. That was the point.”</Note><Small>Verified order · Sep 2026</Small></Card>
          </>
        )}
      </Sec>
      {m.live ? <Btn kind="line" label="Open on mentorsmd.com" onPress={onSite} /> : null}
    </Screen>
  );
}
