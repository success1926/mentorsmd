import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Btn, Field, Hdr, Link, Note, Screen, Small, T, Toggle } from "../components/ui";
import { errorText } from "../lib/api";
import { areaFor, useAuth } from "../lib/auth";
import { useOverlay } from "../lib/demo";
import { useColors } from "../lib/theme";

// The 2-step code after the password, for accounts that need one.
export default function TwoStep() {
  const c = useColors();
  const router = useRouter();
  const { toast } = useOverlay();
  const { sendCode, verify } = useAuth();
  const p = useLocalSearchParams<{ challenge: string; method: "TOTP" | "EMAIL"; email: string }>();
  const [method, setMethod] = useState<"TOTP" | "EMAIL">(p.method === "TOTP" ? "TOTP" : "EMAIL");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // auto: the first code when the screen opens (skipped by the website
  // while an earlier code is still good); "Send a new code" always sends.
  const send = async (auto?: boolean) => {
    try {
      await sendCode(p.challenge, auto);
      if (!auto) toast("New code sent");
    } catch (e) {
      setError(errorText(e));
    }
  };
  // Email codes: send the first one straight away.
  useEffect(() => {
    if (method === "EMAIL") send(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const go = async () => {
    setError(null);
    setBusy(true);
    try {
      const user = await verify(p.challenge, method, code, trust);
      const area = areaFor(user.role);
      router.replace(area || "/");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Hdr title="2-Step Sign-In" />
      <T>{method === "TOTP" ? "Open Your Authenticator App" : "Check Your Email"}</T>
      <Note>{method === "TOTP" ? "Enter the 6-digit code it shows for MentorsMD." : `We sent a 6-digit code to ${p.email || "your email"}. It works for 10 minutes.`}</Note>
      <Field label="Code" value={code} onChange={setCode} numeric big />
      <Toggle tt="Trust this phone" ss="Skip the code on this device for 30 days." value={trust} onChange={setTrust} last />
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      <Btn kind="dark" label={busy ? "Checking…" : "Verify and sign in"} disabled={busy || code.replace(/\s/g, "").length < 6} onPress={go} />
      {method === "EMAIL" ? <Link label="Send a new code" onPress={() => send()} /> : <Link label="Email me a code instead" onPress={() => setMethod("EMAIL")} />}
    </Screen>
  );
}
