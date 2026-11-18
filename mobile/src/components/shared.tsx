import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useDemo, useOverlay } from "../lib/demo";
import { first, money, sampleMentor, type Mentor } from "../lib/sample";
import { fonts, useColors } from "../lib/theme";
import { Av, Bar, Btn, Card, Chip, Chips, Eyebrow, Field, Grow, H, Hdr, Link, Note, Price, Row, RowV, SchoolLogo, Sec, Small, SS, Stars, StatusChip, Toggle, TT } from "./ui";
import { useState } from "react";

// A mentor in a list: photo, rank, school, specialties, "Successful clients at" logos, price and rating.
export function MentorCard({ m }: { m: Mentor }) {
  const c = useColors();
  const router = useRouter();
  return (
    <Card onPress={() => router.push(`/profile/${m.id}`)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 }}>
      <Av init={m.init} photo={m.photo} />
      <Grow gap={4}>
        <TT>{m.name}</TT>
        {m.stage ? <SS style={{ color: c.ink, fontFamily: fonts.bodySemi }}>{m.stage}</SS> : null}
        {m.school ? <RowV gap={8}><SchoolLogo name={m.school} size={20} /><SS style={{ flexShrink: 1 }}>{m.school}</SS></RowV> : null}
        {m.specialties.length ? <View style={{ marginTop: 4 }}><Chips>{m.specialties.slice(0, 2).map((s) => <Chip key={s} label={s} />)}</Chips></View> : null}
        {m.clients.length ? (
          <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 8, marginTop: 6, gap: 5 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11, color: c.muted }}>Successful clients at:</Text>
            <RowV gap={5} style={{ flexWrap: "wrap" }}>{m.clients.slice(0, 5).map((s) => <SchoolLogo key={s} name={s} />)}</RowV>
          </View>
        ) : null}
      </Grow>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Small>From</Small>
        <Price>{money(m.rate)}/hr</Price>
        {m.rating != null ? <Stars>★ {m.rating.toFixed(1)}</Stars> : <Small>New</Small>}
        {m.reviews ? <Small>{m.reviews} reviews</Small> : null}
      </View>
    </Card>
  );
}

// One of the student's packages, with hours used.
export function PkgCard({ id }: { id: string }) {
  const { s } = useDemo();
  const router = useRouter();
  const p = s.pk[id];
  const m = sampleMentor(p.mentor)!;
  return (
    <Card onPress={() => router.push(`/student/package/${id}`)}>
      <RowV>
        <Av init={m.init} size={36} />
        <Grow><TT>{p.title}</TT><SS>{m.name}</SS></Grow>
        <StatusChip status={p.status} />
      </RowV>
      <Bar pct={(p.used / p.hours) * 100} />
      <SS>{p.hours - p.used} of {p.hours} hours left · {p.calls} calls held</SS>
    </Card>
  );
}

// ---------- sheets ----------
// Paying for hours or a package: MentorsMD credit first, then Apple Pay or card.
export function usePaySheet() {
  const { openSheet } = useOverlay();
  return (m: Mentor, what: string, price: number) => openSheet(() => <PaySheet m={m} what={what} price={price} />);
}
function PaySheet({ m, what, price }: { m: Mentor; what: string; price: number }) {
  const { s, change } = useDemo();
  const { closeSheet, faceId, toast } = useOverlay();
  const router = useRouter();
  const credit = s.useCredit ? Math.min(s.credit, price) : 0;
  const paid = () => {
    closeSheet();
    faceId(() => {
      const key = "p" + (Object.keys(s.pk).length + 1);
      const h = parseFloat(what) || Math.max(1, Math.round(price / m.rate));
      change((n) => {
        n.credit -= credit;
        n.pk[key] = { id: key, mentor: m.id, title: isNaN(parseFloat(what)) ? what : `${m.specialties[0] || "Hours"} · ${what}`, hours: h, used: 0, calls: 0, status: "IN_ESCROW", log: [] };
      });
      router.push(`/student/package/${key}`);
      toast(`Paid ${money(price - credit)}. Your hours are ready.`);
    });
  };
  return (
    <>
      <RowV style={{ justifyContent: "space-between" }}><H>Pay MentorsMD</H><Small>Secured by Stripe</Small></RowV>
      <Card>
        <RowV style={{ justifyContent: "space-between" }}><Note ink style={{ flex: 1 }}>{what} · {m.name}</Note><Price>{money(price)}</Price></RowV>
        {s.credit ? <Toggle tt="Use MentorsMD credit" ss={`${money(s.credit)} available`} value={s.useCredit} onChange={(v) => change((n) => { n.useCredit = v; })} last /> : null}
        {credit ? <RowV style={{ justifyContent: "space-between" }}><SS>Credit</SS><TT>−{money(credit)}</TT></RowV> : null}
        <RowV style={{ justifyContent: "space-between", borderTopWidth: 1, borderColor: useColors().line, paddingTop: 10 }}><TT style={{ fontSize: 16 }}>Total</TT><Price style={{ fontSize: 16 }}>{money(price - credit)}</Price></RowV>
      </Card>
      <Btn kind="black" label=" Pay with Apple Pay" onPress={paid} />
      <Btn kind="line" label="Pay with card •••• 4242" onPress={paid} />
      <Small>You pay MentorsMD, not the mentor, and every hour used is logged on your package page. Preview only: nothing is charged.</Small>
    </>
  );
}

export function GuideSheet() {
  const { closeSheet } = useOverlay();
  return (
    <>
      <H>Offer Guide</H>
      <Sec><Eyebrow>When a bundle fits</Eyebrow><Note>Ongoing help across several tasks: a student who wants you for secondaries and interview prep.</Note></Sec>
      <Sec><Eyebrow>When hourly fits</Eyebrow><Note>One-off questions, a quick essay read, a single mock interview.</Note></Sec>
      <Sec><Eyebrow>Example packages</Eyebrow><Note>“Personal Statement, Start to Finish” · about 5 hours · 2 calls + 3 rounds of edits</Note><Note>“MMI Mock Day” · 3 stations + written feedback · 2 hours</Note></Sec>
      <Sec><Eyebrow>Freelancing notes</Eyebrow><Note>You’re an independent mentor. Payouts come from MentorsMD through Stripe; keep records for taxes.</Note></Sec>
      <Btn kind="line" label="Close" onPress={closeSheet} />
    </>
  );
}

export function MoveSheet() {
  const { closeSheet, toast } = useOverlay();
  return (
    <>
      <H>Move This Call</H>
      <Note>It’s more than 24 hours away, so no reason is needed. Inside 24 hours you’ll be asked for one, and it’s shared in your messages.</Note>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["Fri 4:00 PM", "Fri 6:00 PM", "Sat 11:00 AM"].map((t) => (
          <View key={t} style={{ flex: 1 }}><Btn kind="line" sm label={t} style={{ alignSelf: "stretch", paddingHorizontal: 4 }} onPress={() => { closeSheet(); toast(`Call moved to ${t}. Both of you got an email.`); }} /></View>
        ))}
      </View>
      <Link red label="Cancel the call" onPress={() => { closeSheet(); toast("Call cancelled. Hours returned (example)"); }} />
    </>
  );
}

function DeleteSheet({ role }: { role: "student" | "mentor" }) {
  const { s, setRole, reset } = useDemo();
  const { closeSheet, toast } = useOverlay();
  const router = useRouter();
  const [v, setV] = useState("");
  const c = useColors();
  if (role === "mentor")
    return (
      <>
        <H style={{ color: c.danger }}>Delete My Account</H>
        <Card tone="warn"><TT style={{ color: c.warnFg }}>You have {money(s.pay.pending)} not yet paid</TT><Note style={{ color: c.warnFg }}>You can delete your account after your last payout on {s.pay.next}. Until then, you can pause your profile.</Note></Card>
        <Btn kind="line" label="OK" onPress={closeSheet} />
      </>
    );
  return (
    <>
      <H style={{ color: c.danger }}>Delete My Account</H>
      <Note>This happens right away and can’t be undone.</Note>
      <Card tone="warn"><Note style={{ color: c.warnFg }}>Your {money(s.credit)} MentorsMD credit will be lost. Messages you sent will show as “Deleted user”. Receipts are kept for tax records.</Note></Card>
      <Field label="Type DELETE to confirm" value={v} onChange={setV} placeholder="DELETE" />
      <Btn kind="red" label="Delete my account" onPress={() => {
        if (v.trim() !== "DELETE") return toast("Type DELETE to confirm");
        closeSheet(); reset(); setRole(null); router.replace("/"); toast("Your account was deleted (example)");
      }} />
      <Btn kind="line" label="Keep my account" onPress={closeSheet} />
    </>
  );
}

// Settings for everyone: notifications, 2-step, Face ID, trusted devices, sign out, delete.
export function SettingsBody({ role }: { role: "student" | "mentor" | "admin" }) {
  const { s, change, setRole, reset } = useDemo();
  const { toast, openSheet } = useOverlay();
  const router = useRouter();
  const name = role === "mentor" ? "Jordan Ellis" : role === "admin" ? "Taylor Reed" : "Priya Shah";
  const signOut = () => { reset(); setRole(null); router.replace("/"); toast("Signed out"); };
  return (
    <>
      <Card row><Av init={name[0]} /><Grow><TT>{name}</TT><SS>{first(name).toLowerCase()}@example.com</SS></Grow></Card>
      <Sec>
        <Eyebrow>Notifications</Eyebrow>
        <View>
          <Toggle tt="New messages" />
          <Toggle tt="Call reminders" ss="1 hour and 10 minutes before" last={role !== "admin"} />
          {role === "admin" ? <Toggle tt="Urgent admin alerts" ss="New disputes, flags, minors" last /> : null}
        </View>
      </Sec>
      <Sec>
        <Eyebrow>Sign-in and security</Eyebrow>
        <View>
          <Toggle tt="2-step sign-in" ss="A code by email on new devices" value={s.twostep} onChange={(v) => { change((n) => { n.twostep = v; }); toast(v ? "2-step sign-in is on" : "2-step sign-in is off"); }} />
          <Toggle tt="Face ID" ss={role === "admin" ? "Required before refunds, disputes and suspensions" : "Unlock the app with Face ID"} />
          <Row tt="Change password" onPress={() => toast("Change password (example)")} last />
        </View>
      </Sec>
      <Sec>
        <Eyebrow>Trusted devices</Eyebrow>
        <View>
          {s.devices.map((d, i) => (
            <Row key={d.n} tt={d.n} ss={d.w} last={i === s.devices.length - 1}
              rr={i ? <Link red label="Remove" onPress={() => { change((n) => { n.devices.splice(i, 1); }); toast("Device removed. It will need a code next time."); }} /> : undefined} />
          ))}
        </View>
        <Link label="Sign out of all other devices" onPress={() => { change((n) => { n.devices = n.devices.slice(0, 1); }); toast("Signed out of all other devices"); }} />
      </Sec>
      <Btn kind="line" label="Sign out" onPress={signOut} />
      {role !== "admin" ? <Link red style={{ alignSelf: "center" }} label="Delete my account" onPress={() => openSheet(() => <DeleteSheet role={role} />)} /> : null}
      <Small style={{ textAlign: "center" }}>MentorsMD app · preview 1.0 · sample data · Terms · Privacy</Small>
    </>
  );
}

export function SettingsScreenBody({ role }: { role: "student" | "mentor" | "admin" }) {
  return (
    <>
      <Hdr title="Settings" />
      <SettingsBody role={role} />
    </>
  );
}
