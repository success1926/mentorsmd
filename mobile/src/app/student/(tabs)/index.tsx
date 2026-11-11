import { useRouter } from "expo-router";
import { View } from "react-native";
import { MentorCard, PkgCard } from "../../../components/shared";
import { Av, Btn, Card, DateBox, Eyebrow, Grow, Link, Note, RowV, Screen, Sec, SecH, SS, T, TT } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";
import { money, sampleMentor } from "../../../lib/sample";
import { useColors } from "../../../lib/theme";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

export default function StudentHome() {
  const router = useRouter();
  const c = useColors();
  const { s } = useDemo();
  const p1 = s.pk.p1;
  return (
    <Screen>
      <RowV style={{ justifyContent: "space-between" }}>
        <View style={{ gap: 4 }}><Eyebrow>{greeting()}</Eyebrow><T>Hi, Priya</T></View>
        <Av init="P" onPress={() => router.push("/student/settings")} />
      </RowV>
      {p1.status === "COMPLETED" ? (
        <Card tone="tint">
          <Eyebrow>Needs your attention</Eyebrow>
          <TT>Jordan Ellis finished your package</TT>
          <Note>Approve it, or ask for one last call or revision. {p1.left} hours left to decide.</Note>
          <Btn label="Review and approve" onPress={() => router.push("/student/package/p1")} />
        </Card>
      ) : (
        <Card tone="tint"><Eyebrow>Needs your attention</Eyebrow><Note>All caught up. Nothing is waiting for you.</Note></Card>
      )}
      <Sec>
        <Eyebrow>Coming up</Eyebrow>
        <Card row>
          <DateBox dow="TUE" day="17" />
          <Grow><TT>Call with Ben Okafor</TT><SS>7:00 PM ET · 1 hour · from your hours</SS></Grow>
          <Btn kind="dark" sm label="Join" onPress={() => router.push("/call/ben")} />
        </Card>
      </Sec>
      <Sec>
        <SecH><Eyebrow>Your packages</Eyebrow><Link label="See all" onPress={() => router.push("/student/packages")} /></SecH>
        <PkgCard id="p2" />
      </Sec>
      <Card row onPress={() => router.push("/student/credit")}>
        <Grow><TT>MentorsMD credit</TT><SS>Used first at checkout</SS></Grow>
        <TT style={{ color: c.link }}>{money(s.credit)}</TT>
      </Card>
      <Sec>
        <SecH><Eyebrow>Mentors for you</Eyebrow><Link label="Find a mentor" onPress={() => router.push("/student/find")} /></SecH>
        <MentorCard m={sampleMentor("james")!} />
      </Sec>
    </Screen>
  );
}
