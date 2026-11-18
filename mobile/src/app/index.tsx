import * as WebBrowser from "expo-web-browser";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Btn, Card, Field, Grow, Link, Loading, Logo, Note, RowV, Screen, Small, SS } from "../components/ui";
import { SITE, errorText } from "../lib/api";
import { areaFor, useAuth } from "../lib/auth";
import { fonts, useColors } from "../lib/theme";

// Sign in with a MentorsMD account (the same email and password as the
// website). New students and mentor applicants sign up on the website.
export default function SignIn() {
  const c = useColors();
  const router = useRouter();
  const { user, ready, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <Screen><Loading /></Screen>;
  const area = user ? areaFor(user.role) : null;
  if (user && area) return <Redirect href={area} />;

  const go = async () => {
    setError(null);
    if (!email.trim() || !pw) return setError("Enter your email and password.");
    setBusy(true);
    try {
      const r = await signIn(email, pw);
      if (r.status === "needs-code") {
        router.push({ pathname: "/two-step", params: { challenge: r.challenge, method: r.method, email: r.email } });
      } else if (!areaFor(r.user.role)) {
        setError("Team accounts use the MentorsMD website. Students and mentors can sign in here.");
      }
      setPw("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
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

      {user && !area ? (
        <Card tone="warn"><Note style={{ color: c.warnFg }}>Team accounts use the MentorsMD website. Students and mentors can sign in here.</Note></Card>
      ) : null}

      <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" />
      <Field label="Password" value={pw} onChange={setPw} secure />
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      <Btn kind="dark" label={busy ? "Signing in…" : "Sign in"} disabled={busy} onPress={go} />
      <RowV style={{ justifyContent: "space-between" }}>
        <Link label="Forgot password?" onPress={() => WebBrowser.openBrowserAsync(SITE + "/forgot-password")} />
        <Link label="Create an account" onPress={() => WebBrowser.openBrowserAsync(SITE + "/signup")} />
      </RowV>
      <Btn kind="line" label="Browse mentors without signing in" onPress={() => router.push("/browse")} />
      <Grow><SS style={{ textAlign: "center" }}>Mentors apply on mentorsmd.com, then sign in here.</SS></Grow>
    </Screen>
  );
}
