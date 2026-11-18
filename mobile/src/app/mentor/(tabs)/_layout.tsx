import { useEffect } from "react";
import { AppState } from "react-native";
import { AreaTabs } from "../../../components/tabs";
import { useApi } from "../../../lib/api";

// The Messages badge is the website's unread count (/api/me/nav), checked
// every 30 seconds and whenever the app comes back to the front.
export default function MentorTabs() {
  const nav = useApi<{ unread: number }>("/api/me/nav");
  const { reload } = nav;
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") reload(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [reload]);
  return (
    <AreaTabs tabs={[
      { name: "index", title: "Home", icon: "home" },
      { name: "students", title: "Students", icon: "users" },
      { name: "messages", title: "Messages", icon: "message-square", badge: nav.data?.unread || 0 },
      { name: "calendar", title: "Calendar", icon: "calendar" },
      { name: "more", title: "More", icon: "more-horizontal" },
    ]} />
  );
}
