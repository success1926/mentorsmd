import { useRouter } from "expo-router";
import { View } from "react-native";
import { LoadError, useRefresh } from "../../../components/shared";
import { Av, Btn, Card, Loading, Note, Row, Screen, Small, SS, T, TT } from "../../../components/ui";
import { useApi } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { ago, fmtWhen, initials, shortHours } from "../../../lib/orders";
import { useColors } from "../../../lib/theme";

type Convo = {
  id: string;
  buyerUnread: number;
  createdAt: string;
  seller: { id: string; name: string; photoUrl: string | null; credential: string | null };
  messages: { body: string; senderId: string; attachmentName: string | null; createdAt: string }[];
  context: { package: { id: string; title: string; minutesLeft: number } | null; introCallAt: string | null };
};

// Messages (/api/conversations): one conversation per mentor, newest first.
// Checked again every 15 seconds while this tab is open.
export default function Messages() {
  const router = useRouter();
  const c = useColors();
  const { user } = useAuth();
  const list = useApi<{ conversations: Convo[] }>("/api/conversations");
  useRefresh(list.reload, 15_000);
  const rows = list.data?.conversations || [];
  return (
    <Screen>
      <T>Messages</T>
      {list.loading && !list.data ? <Loading /> : null}
      {list.error && !list.data ? <LoadError error={list.error} onRetry={list.reload} title="Couldn’t load your messages" /> : null}
      {list.data && !rows.length ? (
        <Card>
          <TT>No messages yet</TT>
          <Note>Messaging is free. Ask a mentor anything before you buy.</Note>
          <Btn kind="line" sm label="Find a mentor" onPress={() => router.push("/student/find")} />
        </Card>
      ) : null}
      {rows.length ? (
        <View>
          {rows.map((cv, i) => {
            const last = cv.messages[0];
            const unread = cv.buyerUnread > 0;
            const preview = last ? `${last.senderId === user?.id ? "You: " : ""}${last.body || (last.attachmentName ? `File: ${last.attachmentName}` : "")}` : "No messages yet";
            const ctx = cv.context.package ? `${cv.context.package.title} · ${shortHours(cv.context.package.minutesLeft)} left` : cv.context.introCallAt ? `Intro call ${fmtWhen(cv.context.introCallAt)}` : "";
            return (
              <Row key={cv.id} left={<Av init={initials(cv.seller.name)} photo={cv.seller.photoUrl} size={40} />}
                tt={<TT numberOfLines={1}>{cv.seller.name}</TT>}
                ss={<View style={{ gap: 1 }}><SS numberOfLines={1} style={unread ? { color: c.ink } : undefined}>{preview}</SS>{ctx ? <Small>{ctx}</Small> : null}</View>}
                rr={<View style={{ alignItems: "flex-end", gap: 4 }}><SS>{ago(last?.createdAt || cv.createdAt)}</SS>{unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}</View>}
                chevron={false} last={i === rows.length - 1} onPress={() => router.push(`/student/chat/${cv.id}`)} />
            );
          })}
        </View>
      ) : null}
      <Small>Keep payments and contact details on MentorsMD. Messages are checked for safety.</Small>
    </Screen>
  );
}
