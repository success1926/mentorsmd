import { useRouter } from "expo-router";
import { View } from "react-native";
import { Av, Bar, Btn, Card, Eyebrow, Grow, Icon, Loading, Note, Row, Screen, Sec, Small, SS, TT, Hdr } from "../../components/ui";
import { ErrorBox, openSite, useReloadOnFocus } from "../../components/mentorSheets";
import { useApi } from "../../lib/api";
import { useColors } from "../../lib/theme";
import { initialsOf } from "../../lib/format";

type Section = { key: string; label: string; done: boolean; hint: string; href: string };
type Profile = {
  id: string; name: string; credential: string | null; bio: string | null; photoUrl: string | null; mentorStage: string | null; medicalSchool: string | null; undergradSchool: string | null;
  profileStatus: string; progress?: { sections: Section[]; done: number; total: number; complete: boolean };
};

const STAGE: Record<string, string> = { UNDERGRAD: "Undergrad student", GAP_YEAR: "Gap year", MS1: "MS1", MS2: "MS2", MS3: "MS3", MS4: "MS4", RESIDENT: "Resident" };

// The mentor's own profile: a short summary and the website's "Finish your
// profile" checklist (/api/profile). The full 10-step editor (photo, bio,
// schools, admissions experience...) is on mentorsmd.com.
export default function MyProfile() {
  const router = useRouter();
  const c = useColors();
  const q = useApi<{ profile: Profile }>("/api/profile");
  useReloadOnFocus(q.reload);
  const p = q.data?.profile;
  const prog = p?.progress;
  const school = p ? (["UNDERGRAD", "GAP_YEAR", "OTHER"].includes(p.mentorStage || "") ? p.undergradSchool : p.medicalSchool) || p.medicalSchool : null;
  return (
    <Screen>
      <Hdr title="My Profile" sub={prog ? (prog.complete ? "Complete" : `${prog.done} of ${prog.total} steps done`) : undefined} />
      {q.loading && !p ? <Loading /> : !p ? <ErrorBox error={q.error || "Couldn’t load your profile"} onRetry={q.reload} /> : (
        <>
          <Card row>
            <Av init={initialsOf(p.name)} photo={p.photoUrl} size={56} />
            <Grow>
              <TT>{p.name}</TT>
              {p.credential ? <SS>{p.credential}</SS> : null}
              {[p.mentorStage ? STAGE[p.mentorStage] : null, school].filter(Boolean).length ? <SS>{[p.mentorStage ? STAGE[p.mentorStage] : null, school].filter(Boolean).join(" · ")}</SS> : null}
            </Grow>
          </Card>
          {p.bio ? <Note>{p.bio}</Note> : null}

          {prog ? (
            <Sec>
              <Eyebrow>{prog.complete ? "Your profile is complete" : "Finish your profile"}</Eyebrow>
              <Bar pct={(prog.done / Math.max(1, prog.total)) * 100} />
              {!prog.complete ? <Note>Your profile is hidden from Browse until it’s complete. Students can’t find you or buy from you yet.</Note> : null}
              <View>
                {prog.sections.map((s, i) => (
                  <Row key={s.key} left={<Icon name={s.done ? "check-circle" : "circle"} size={20} color={s.done ? c.okFg : c.faint} />} tt={s.label} ss={!s.done && s.hint ? s.hint : undefined}
                    onPress={() => (s.key === "rate" ? router.push("/mentor/rates") : openSite(s.href))} last={i === prog.sections.length - 1} />
                ))}
              </View>
            </Sec>
          ) : null}

          <Btn kind="dark" label="Edit on mentorsmd.com" onPress={() => openSite("/dashboard/profile")} />
          <Btn kind="line" label="See my profile as students see it" onPress={() => router.push(`/profile/${p.id}`)} />
          <Small>Changes you make on mentorsmd.com show here when you come back.</Small>
        </>
      )}
    </Screen>
  );
}
