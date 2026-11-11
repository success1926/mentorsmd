import { AreaTabs } from "../../../components/tabs";
import { useDemo } from "../../../lib/demo";
export default function AdminTabs() {
  const { s } = useDemo();
  const inbox = s.apps.filter((x) => x.status === "New").length + s.disputes.filter((d) => d.status === "Open").length;
  return (
    <AreaTabs tabs={[
      { name: "index", title: "Overview", icon: "home" },
      { name: "inbox", title: "Inbox", icon: "inbox", badge: inbox },
      { name: "people", title: "People", icon: "users" },
      { name: "money", title: "Money", icon: "credit-card" },
      { name: "more", title: "More", icon: "more-horizontal" },
    ]} />
  );
}
