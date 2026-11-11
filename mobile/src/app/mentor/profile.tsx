import { useRouter } from "expo-router";
import { useState } from "react";
import { Bar, Btn, Chips, Eyebrow, FChip, Field, Hdr, Screen, SchoolList, Search, Sec, Select, Small } from "../../components/ui";
import { useOverlay } from "../../lib/demo";
import { BEST_FOR, sampleMentor, SERVICES } from "../../lib/sample";

// The mentor's own profile editor (the website has the full 10 steps).
export default function MyProfile() {
  const router = useRouter();
  const { toast } = useOverlay();
  const me = sampleMentor("leah")!;
  const [stage, setStage] = useState("Medical Student – Year 4");
  const [school, setSchool] = useState(me.school);
  const [bio, setBio] = useState(me.bio);
  const [svc, setSvc] = useState(me.svc);
  const [best, setBest] = useState(me.best);
  const [clients, setClients] = useState(me.clients);
  const [find, setFind] = useState("");
  const [fun, setFun] = useState("");
  const flip = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Screen>
      <Hdr title="My Profile" sub="85% complete" />
      <Bar pct={85} />
      <Btn kind="line" label="See my profile as students see it" onPress={() => router.push("/profile/leah")} />
      <Select label="Where are you now?" options={["Medical Student – Year 4", "Resident", "Gap year", "Undergrad student", "Other"]} value={stage} onChange={setStage} />
      <Field label="Medical school" value={school} onChange={setSchool} />
      <Field label="Bio" value={bio} onChange={setBio} multiline />
      <Sec><Eyebrow>Specialties</Eyebrow><Chips>{Object.entries(SERVICES).map(([k, l]) => <FChip key={k} label={l} on={svc.includes(k)} onPress={() => setSvc(flip(svc, k))} />)}</Chips></Sec>
      <Sec><Eyebrow>Best for</Eyebrow><Chips>{BEST_FOR.map((l) => <FChip key={l} label={l} on={best.includes(l)} onPress={() => setBest(flip(best, l))} />)}</Chips></Sec>
      <Sec>
        <Eyebrow>Schools your students got into (optional)</Eyebrow>
        <SchoolList schools={clients} />
        <Search value={find} onChange={setFind} placeholder="Search medical schools" />
        <Btn kind="line" label="+ Add a school" onPress={() => {
          const v = find.trim();
          if (!v) return toast("Type a school name first");
          setClients([...clients, v]); setFind(""); toast("School added. The profile updates within a minute.");
        }} />
        <Small>{clients.length} of 12 · shown as logos on your card and profile</Small>
      </Sec>
      <Field label="Fun fact" value={fun} onChange={setFun} placeholder="Add a fun fact" />
      <Btn kind="dark" label="Save" onPress={() => toast("Profile saved")} />
    </Screen>
  );
}
