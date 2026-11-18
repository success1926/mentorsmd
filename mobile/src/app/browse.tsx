import { useCompareFooter } from "../components/brand";
import { FindBody } from "../components/find";
import { Hdr, Screen } from "../components/ui";

// Find a Mentor for visitors: the real mentors on mentorsmd.com.
export default function Browse() {
  const footer = useCompareFooter();
  return (
    <Screen footer={footer}>
      <Hdr title="Browse mentors" sub="Live from mentorsmd.com" />
      <FindBody allowSample={false} />
    </Screen>
  );
}
