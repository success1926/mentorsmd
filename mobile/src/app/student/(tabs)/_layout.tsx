import { AreaTabs } from "../../../components/tabs";
export default function StudentTabs() {
  return (
    <AreaTabs tabs={[
      { name: "index", title: "Home", icon: "home" },
      { name: "packages", title: "Packages", icon: "package" },
      { name: "messages", title: "Messages", icon: "message-square", badge: 1 },
      { name: "find", title: "Find", icon: "search" },
      { name: "more", title: "More", icon: "more-horizontal" },
    ]} />
  );
}
