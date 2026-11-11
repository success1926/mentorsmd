import { AreaTabs } from "../../../components/tabs";
export default function MentorTabs() {
  return (
    <AreaTabs tabs={[
      { name: "index", title: "Home", icon: "home" },
      { name: "students", title: "Students", icon: "users" },
      { name: "messages", title: "Messages", icon: "message-square", badge: 2 },
      { name: "calendar", title: "Calendar", icon: "calendar" },
      { name: "more", title: "More", icon: "more-horizontal" },
    ]} />
  );
}
