import { PkgCard } from "../../../components/shared";
import { Eyebrow, Screen, Sec, Small, T } from "../../../components/ui";
import { useDemo } from "../../../lib/demo";

export default function Packages() {
  const { s } = useDemo();
  const all = Object.values(s.pk);
  const active = all.filter((p) => p.status !== "RELEASED" && p.status !== "REFUNDED");
  const done = all.filter((p) => p.status === "RELEASED" || p.status === "REFUNDED");
  return (
    <Screen>
      <T>My Packages</T>
      {active.length ? <Sec><Eyebrow>Active</Eyebrow>{active.map((p) => <PkgCard key={p.id} id={p.id} />)}</Sec> : null}
      {done.length ? <Sec><Eyebrow>Finished</Eyebrow>{done.map((p) => <PkgCard key={p.id} id={p.id} />)}</Sec> : null}
      <Small>You pay MentorsMD, not the mentor. Every hour used is logged on your package page.</Small>
    </Screen>
  );
}
