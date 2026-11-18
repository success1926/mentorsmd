import { useRouter } from "expo-router";
import { LoadError, PkgCard, useRefresh } from "../../../components/shared";
import { Btn, Card, Eyebrow, Loading, Note, Screen, Sec, Small, T, TT } from "../../../components/ui";
import { useApi } from "../../../lib/api";
import { isActive, type Pkg } from "../../../lib/orders";

// My Packages (/api/packages): active ones first, then finished.
export default function Packages() {
  const router = useRouter();
  const pk = useApi<{ packages: Pkg[] }>("/api/packages");
  useRefresh(pk.reload);
  const all = pk.data?.packages || [];
  const active = all.filter(isActive);
  const done = all.filter((p) => !isActive(p));
  return (
    <Screen>
      <T>My Packages</T>
      {pk.loading && !pk.data ? <Loading /> : null}
      {pk.error && !pk.data ? <LoadError error={pk.error} onRetry={pk.reload} title="Couldn’t load your packages" /> : null}
      {pk.data && !all.length ? (
        <Card>
          <TT>No packages yet</TT>
          <Note>Buy hours or a package from a mentor’s profile. Message any mentor for free first, or book a free 15-minute intro call.</Note>
          <Btn kind="line" sm label="Find a mentor" onPress={() => router.push("/student/find")} />
        </Card>
      ) : null}
      {active.length ? <Sec><Eyebrow>Active</Eyebrow>{active.map((p) => <PkgCard key={p.id} p={p} />)}</Sec> : null}
      {done.length ? <Sec><Eyebrow>Finished</Eyebrow>{done.map((p) => <PkgCard key={p.id} p={p} />)}</Sec> : null}
      <Small>You pay MentorsMD, not the mentor. Every hour used is logged on your package page.</Small>
    </Screen>
  );
}
