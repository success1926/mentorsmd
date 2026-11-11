import { useState } from "react";
import { Btn, Field, Hdr, Note, Screen, Select } from "../../components/ui";
import { useOverlay } from "../../lib/demo";

export default function AboutYou() {
  const { toast } = useOverlay();
  const [now, setNow] = useState("Applying this cycle");
  const [year, setYear] = useState("2027");
  const [college, setCollege] = useState("University of Michigan · Biology");
  const [mcat, setMcat] = useState("514 (Aug 2026)");
  const [help, setHelp] = useState("Personal statement first, then MMI practice before December interviews.");
  return (
    <Screen>
      <Hdr title="About You" />
      <Note>Mentors you work with see this, so your first call starts in the right place.</Note>
      <Select label="Where are you now?" options={["Applying this cycle", "Planning to apply", "Reapplying", "BS/MD applicant"]} value={now} onChange={setNow} />
      <Select label="Application year" options={["2027", "2028"]} value={year} onChange={setYear} />
      <Field label="College" value={college} onChange={setCollege} />
      <Field label="MCAT" value={mcat} onChange={setMcat} />
      <Field label="What do you want help with?" value={help} onChange={setHelp} multiline />
      <Btn kind="dark" label="Save" onPress={() => toast("Saved")} />
    </Screen>
  );
}
