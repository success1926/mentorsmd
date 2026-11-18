import { useEffect } from "react";
import { AreaTabs } from "../../../components/tabs";
import { useApi } from "../../../lib/api";

// The Messages badge is the unread count the website's top bar shows
// (/api/me/nav), checked every 30 seconds.
export default function StudentTabs() {
  const nav = useApi<{ unread: number }>("/api/me/nav");
  const { reload } = nav;
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);
  return (
    <AreaTabs tabs={[
      { name: "index", title: "Home", icon: "home" },
      { name: "packages", title: "Packages", icon: "package" },
      { name: "messages", title: "Messages", icon: "message-square", badge: nav.data?.unread || 0 },
      { name: "find", title: "Find", icon: "search" },
      { name: "more", title: "More", icon: "more-horizontal" },
    ]} />
  );
}
