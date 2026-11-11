import { useRouter } from "expo-router";
import { useState } from "react";
import { Btn, Field, Hdr, Link, Note, Screen, T, Toggle } from "../components/ui";
import { useDemo, useOverlay } from "../lib/demo";

export default function TwoStep() {
  const router = useRouter();
  const { setRole, reset } = useDemo();
  const { toast } = useOverlay();
  const [code, setCode] = useState("482 913");
  return (
    <Screen>
      <Hdr title="2-Step Sign-In" />
      <T>Check Your Email</T>
      <Note>We sent a 6-digit code to p•••••@example.com. It works for 10 minutes.</Note>
      <Field label="Code" value={code} onChange={setCode} numeric big />
      <Toggle tt="Trust this iPhone" ss="Skip the code on this device for 30 days. You can remove it in Settings." last />
      <Btn kind="dark" label="Verify and sign in" onPress={() => { reset(); setRole("student"); router.replace("/student"); toast("Signed in · this iPhone is trusted for 30 days"); }} />
      <Link label="Send a new code" onPress={() => toast("New code sent (example)")} />
    </Screen>
  );
}
