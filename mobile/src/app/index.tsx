import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Btn, Card, Eyebrow, Field, Grow, Link, Logo, Note, Row, RowV, Screen, Sec, Small, SS, T, TT } from "../components/ui";
import { useDemo, useOverlay, type Role } from "../lib/demo";
import { fonts, useColors } from "../lib/theme";

// Sign in. In this preview build sign-in isn't connected to real accounts:
// every way in opens the student area with sample data, and the buttons
// below open each area directly.
export default function SignIn() {
  const c = useColors();
  const router = useRouter();
  const { setRole, reset } = useDemo();
  const { toast } = useOverlay();
  const [email, setEmail] = useState("priya.shah@example.com");
  const [pw, setPw] = useState("example-only");
  const enter = (r: Role, msg?: string) => {
    reset();
    setRole(r);
    router.replace(`/${r}`);
    if (msg) toast(msg);
  };
  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ alignItems: "center", gap: 6, marginTop: 28 }}>
        <Logo size={64} />
        <Text style={{ fontFamily: fonts.display, fontSize: 38, color: c.ink, letterSpacing: -0.6 }}>
          Mentors<Text style={{ color: c.primary }}>MD</Text>
        </Text>
        <Note>Your White Coat Starts Here</Note>
      </View>

      <Card tone="warn">
        <TT style={{ color: c.warnFg }}>Preview build</TT>
        <Note style={{ color: c.warnFg }}>Sign-in isn’t connected yet. Signed-in screens use invented sample people and numbers. Find a mentor can show the real mentors on mentorsmd.com.</Note>
      </Card>

      <Sec>
        <Eyebrow>Look around as</Eyebrow>
        <View>
          <Row tt="Student · Priya Shah" ss="Packages, messages, booking, paying, approving" onPress={() => enter("student")} />
          <Row tt="Mentor · Jordan Ellis" ss="Students, logging work, calendar, rates, payouts" onPress={() => enter("mentor")} />
          <Row tt="Admin · Taylor Reed" ss="Urgent items: applications, disputes, refunds" onPress={() => enter("admin")} />
          <Row tt="Visitor" ss="Browse the real mentors without signing in" onPress={() => router.push("/browse")} last />
        </View>
      </Sec>

      <Sec>
        <Btn kind="black" label=" Sign in with Apple" onPress={() => enter("student", "Signed in with Apple (preview)")} />
        <Btn kind="line" label="Continue with Google" onPress={() => enter("student", "Signed in with Google (preview)")} />
      </Sec>
      <Small style={{ textAlign: "center" }}>or with your email</Small>
      <Field label="Email" value={email} onChange={setEmail} />
      <Field label="Password" value={pw} onChange={setPw} secure />
      <Btn kind="dark" label="Sign in" onPress={() => router.push("/two-step")} />
      <RowV style={{ justifyContent: "space-between" }}>
        <Link label="Forgot password?" onPress={() => toast("We emailed you a reset link (example)")} />
        <Link label="Create an account" onPress={() => toast("New accounts open the website sign-up (example)")} />
      </RowV>
      <Grow><SS style={{ textAlign: "center" }}>MentorsMD app preview · Nov 2026</SS></Grow>
    </Screen>
  );
}
