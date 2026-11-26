import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from "react-native";
import { useSafetySheet } from "../../../components/safety";
import { LoadError, useRefresh } from "../../../components/shared";
import { Btn, Bubble, Card, FChip, Hdr, Link, Loading, Note, RowV, Screen, Small, TT } from "../../../components/ui";
import { api, ApiError, errorText, useApi } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { fonts, useColors } from "../../../lib/theme";
import { firstName, fmtDay, fmtTime } from "../../../lib/format";

type Msg = { id: string; body: string; senderId: string; attachmentName: string | null; createdAt: string; orderId: string | null; sender?: { id: string; name: string; role: string } };
type Ctx = {
  conversation: { id: string; seller: { id: string; name: string; credential: string | null; photoUrl: string | null; awayNote?: string | null } };
  safety: { iBlocked: boolean; theyBlocked: boolean; emailConfirmed: boolean; onHold: boolean };
  orders: { id: string; status: string; kind: string | null }[];
};
type Warning = { kind: string; text: string };

// One conversation with a mentor (/api/conversations/[id]/messages).
// New messages are checked every 5 seconds while it's open.
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const safety = useSafetySheet();
  const ctx = useApi<Ctx>(`/api/conversations/${encodeURIComponent(id)}`);
  const msgs = useApi<{ messages: Msg[] }>(`/api/conversations/${encodeURIComponent(id)}/messages`);
  const { reload: reloadMsgs } = msgs;
  useRefresh(reloadMsgs, 5_000);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Warning[] | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  const mentor = ctx.data?.conversation.seller;
  const name1 = firstName(mentor?.name);
  const blocked = ctx.data?.safety.iBlocked ? `You blocked ${name1}. Unblock them to send a message.` : ctx.data?.safety.theyBlocked ? "You can’t message this person." : "";
  const list = msgs.data?.messages || [];
  const hasPackage = (ctx.data?.orders || []).some((o) => ["IN_ESCROW", "COMPLETED", "RELEASED"].includes(o.status));

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(t);
  }, [list.length]);

  const send = async (acknowledgeWarnings = false) => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await api<{ message: Msg }>(`/api/conversations/${encodeURIComponent(id)}/messages`, { body: { body: text, acknowledgeWarnings: acknowledgeWarnings || undefined } });
      setDraft("");
      setWarnings(null);
      msgs.setData((d) => ({ messages: [...(d?.messages || []).filter((m) => m.id !== r.message.id), r.message] }));
    } catch (e) {
      // Keep the draft. Off-site / ghostwriting warnings can be read and sent anyway.
      if (e instanceof ApiError && e.data?.code === "WARNING") setWarnings(e.data.warnings || []);
      else {
        setError(errorText(e));
        if (e instanceof ApiError && e.data?.code === "BLOCKED_USER") ctx.reload();
      }
    } finally {
      setSending(false);
    }
  };

  const footer = ctx.data ? (
    blocked ? <Small style={{ textAlign: "center" }}>{blocked}</Small> : (
      <>
        {warnings ? (
          <Card tone="warn">
            <TT>Please read this before sending</TT>
            {warnings.map((w) => <Note key={w.kind} style={{ color: c.warnFg }}>{w.text}</Note>)}
            <RowV gap={8}><Btn sm kind="line" label="Edit message" onPress={() => setWarnings(null)} /><Btn sm label="Send anyway" disabled={sending} onPress={() => send(true)} /></RowV>
          </Card>
        ) : null}
        {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
        {mentor ? (
          <RowV gap={8}>
            {!hasPackage ? <FChip label="Book free intro call" onPress={() => router.push(`/student/book?m=${encodeURIComponent(mentor.id)}&kind=intro&name=${encodeURIComponent(mentor.name)}`)} /> : null}
            <FChip label={hasPackage ? "Book a call" : "See packages"} onPress={() => router.push(hasPackage ? `/student/book?m=${encodeURIComponent(mentor.id)}&kind=call&name=${encodeURIComponent(mentor.name)}` : `/profile/${mentor.id}`)} />
          </RowV>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <TextInput value={draft} onChangeText={setDraft} placeholder={`Message ${name1 || "your mentor"}`} placeholderTextColor={c.faint} accessibilityLabel="Message" multiline
            style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.body, fontSize: 15, color: c.ink }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={sending || !draft.trim()} onPress={() => send(false)}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", opacity: sending || !draft.trim() ? 0.5 : 1 }}>
            <Feather name="send" size={18} color={c.onPrimary} />
          </Pressable>
        </View>
      </>
    )
  ) : null;

  let lastDay = "";
  return (
    <Screen scroll={false} footer={footer}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 6 }}>
        <Hdr title={mentor?.name || "Messages"} sub={mentor?.credential || undefined} />
        {mentor ? (
          <RowV style={{ justifyContent: "space-between" }}>
            <Link label="View profile" onPress={() => router.push(`/profile/${mentor.id}`)} />
            <Link label="Report or block" onPress={() => safety({ userId: mentor.id, name: mentor.name, conversationId: id }, () => ctx.reload())} />
          </RowV>
        ) : null}
        {mentor?.awayNote ? <Small>{mentor.awayNote}</Small> : null}
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 8, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {(ctx.loading && !ctx.data) || (msgs.loading && !msgs.data) ? <Loading /> : null}
        {ctx.error && !ctx.data ? <LoadError error={ctx.error} onRetry={ctx.reload} title="Couldn’t open this conversation" /> : null}
        {msgs.error && !msgs.data ? <LoadError error={msgs.error} onRetry={msgs.reload} title="Couldn’t load the messages" /> : null}
        {msgs.data && !list.length ? <Bubble who="sys">Say hi. Messaging is free, and you can ask anything before you buy.</Bubble> : null}
        {list.map((m) => {
          const day = fmtDay(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.senderId === user?.id;
          const staff = m.sender?.role === "ADMIN";
          return (
            <View key={m.id} style={{ gap: 4 }}>
              {showDay ? <Small style={{ textAlign: "center", marginTop: 6 }}>{day}</Small> : null}
              <Bubble who={staff ? "sys" : mine ? "me" : "them"}>
                {staff ? `${m.sender?.name || "MentorsMD team"}: ` : ""}{m.body}{m.attachmentName ? `${m.body ? "\n" : ""}File: ${m.attachmentName} (open it on mentorsmd.com)` : ""}
              </Bubble>
              <Small style={{ alignSelf: mine ? "flex-end" : "flex-start", fontSize: 11 }}>{fmtTime(m.createdAt)}</Small>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
