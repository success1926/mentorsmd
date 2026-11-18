import { useCompareFooter } from "../../../components/brand";
import { FindBody } from "../../../components/find";
import { Screen } from "../../../components/ui";

export default function Find() {
  const footer = useCompareFooter();
  return (
    <Screen footer={footer}>
      <FindBody />
    </Screen>
  );
}
