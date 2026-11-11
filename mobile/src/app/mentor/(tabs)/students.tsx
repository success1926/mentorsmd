import { useRouter } from "expo-router";
import { Av, Bar, Card, Chip, Grow, RowV, Screen, SS, StatusChip, T, TT } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";
import { initials } from "../../../lib/sample";

export default function Students() {
  const router = useRouter();
  const { s } = useDemo();
  return (
    <Screen>
      <T>Students & Packages</T>
      {Object.entries(s.mPk).map(([k, p]) => (
        <Card key={k} onPress={() => router.push(`/mentor/package/${k}`)}>
          <RowV>
            <Av init={initials(p.student)} size={36} />
            <Grow><RowV gap={6}><TT>{p.student}</TT>{p.minor ? <Chip label="Under 18" tone="gray" /> : null}</RowV><SS>{p.title}</SS></Grow>
            <StatusChip status={p.status} />
          </RowV>
          <Bar pct={(p.used / p.hours) * 100} />
          <SS>{p.hours - p.used} of {p.hours} hours left · due {p.due}</SS>
        </Card>
      ))}
    </Screen>
  );
}
