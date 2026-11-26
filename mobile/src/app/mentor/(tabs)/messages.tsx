import { useRouter } from "expo-router";
import { View } from "react-native";
import { Av, EmptyState, LoadError, Loading, Row, Screen, SS, T } from "../../../components/ui";
import { useReloadOnFocus } from "../../../components/mentorSheets";
import { useApi } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useColors } from "../../../lib/theme";
import { ago, fmtDayShort, initialsOf } from "../../../lib/format";
import { shortHours } from "../../../lib/orders";

// The mentor's conversations (/api/conversations), most recent first, with
// the same line under each name as the website's inbox.
function contextLine(cv: any, userId: string) {
  const pkg = cv.context?.package;
  if (pkg) return `${pkg.title} · ${shortHours(pkg.minutesLeft)} left${pkg.count > 1 ? ` (+${pkg.count - 1} more)` : ""}`;
  const intro = cv.context?.introCallAt;
  if (intro) return `No package yet · intro call booked ${fmtDayShort(intro)}`;
  const last = cv.messages?.[0];
  if (last && last.senderId === userId) return "Waiting for a reply";
  return null;
}

export default function MentorMessages() {
  const router = useRouter();
  const c = useColors();
  const { user } = useAuth();
  const q = useApi<{ conversations: any[] }>("/api/conversations");
  useReloadOnFocus(q.reload);
  const list = q.data?.conversations || [];
  return (
    <Screen>
      <T>Messages</T>
      {q.loading && !q.data ? <Loading /> : q.error && !q.data ? <LoadError error={q.error} onRetry={q.reload} /> : !list.length ? (
        <EmptyState title="No messages yet">When a student writes to you, the conversation shows up here.</EmptyState>
      ) : (
        <View>
          {list.map((cv, i) => {
            const last = cv.messages?.[0];
            const unread = cv.sellerUnread > 0;
            const ctx = contextLine(cv, user?.id || "");
            const preview = last ? `${last.senderId === user?.id ? "You: " : ""}${last.body || (last.attachmentName ? `Sent a file: ${last.attachmentName}` : "")}` : "No messages yet";
            return (
              <Row key={cv.id} left={<Av init={initialsOf(cv.buyer?.name)} photo={cv.buyer?.photoUrl} size={40} />}
                tt={cv.buyer?.name || "Student"}
                ss={<View style={{ gap: 1 }}>{ctx ? <SS numberOfLines={1} style={{ color: c.deep }}>{ctx}</SS> : null}<SS numberOfLines={1}>{preview}</SS></View>}
                rr={<View style={{ alignItems: "flex-end", gap: 4 }}><SS>{ago(last?.createdAt || cv.createdAt)}</SS>{unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}</View>}
                chevron={false} last={i === list.length - 1} onPress={() => router.push(`/mentor/chat/${cv.id}`)} />
            );
          })}
        </View>
      )}
    </Screen>
  );
}
