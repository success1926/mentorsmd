import { useState } from "react";
import { Btn, Btns2, Bubble, Field, H, Half, Note } from "./ui";
import { useOverlay } from "../lib/demo";

export function FlagSheet() {
  const { closeSheet, toast } = useOverlay();
  const done = (m: string) => { closeSheet(); toast(m); };
  return (
    <>
      <H>Flagged Message</H>
      <Bubble who="them">Maya Lin: “Easier to text me at (555) 0•• ••••”</Bubble>
      <Note>Contact details were hidden automatically. Keep payments and contact on MentorsMD.</Note>
      <Btns2>
        <Half><Btn kind="line" label="Dismiss" onPress={() => done("Dismissed")} /></Half>
        <Half><Btn kind="dark" label="Send a warning" onPress={() => done("Warning sent to Maya")} /></Half>
      </Btns2>
    </>
  );
}

export function LeadSheet({ name }: { name: string }) {
  const { closeSheet, toast } = useOverlay();
  const [v, setV] = useState("Thanks for reaching out! Here’s how MentorsMD works…");
  return (
    <>
      <H>{name}</H>
      <Note>Received through the website. Reply goes out by email from success@mentorsmd.com (example).</Note>
      <Field label="Reply" value={v} onChange={setV} multiline />
      <Btns2>
        <Half><Btn kind="line" label="Mark done" onPress={() => { closeSheet(); toast("Marked done"); }} /></Half>
        <Half><Btn kind="dark" label="Send reply" onPress={() => { closeSheet(); toast("Reply sent (example)"); }} /></Half>
      </Btns2>
    </>
  );
}

export const personTone = (st: string) => (st === "Suspended" ? "bad" : st === "Active" ? "ok" : "warn") as "bad" | "ok" | "warn";
