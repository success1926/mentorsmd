import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, View, type ScrollViewInstance } from "react-native";
import { useSafetySheet } from "../../../components/safety";
import { Bubble, Card, Hdr, Link, Loading, Note, Row, RowV, Screen, Small } from "../../../components/ui";
import { ErrText, ErrorBox, MessageBox, WarningsCard, firstName, hoursSummary, shortHours, warningsOf, type Warning } from "../../../components/mentorSheets";
import { api, errorText, useApi } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

type Msg = { id: string; body: string; senderId: string; createdAt: string; attachmentName: string | null; attachmentUrl: string | null; orderId: string | null; sender?: { role: string; name: string } };
type Convo = {
  conversation: { id: string; buyerId: string; buyer: { id: string; name: string; minorStatus?: string | null } };
  safety: { iBlocked: boolean; theyBlocked: boolean };
  orders: any[];
};

const POLL_MS = 5000;

// A conversation with a student: the website's messages, checked every 5
// seconds while it's open (the website uses realtime; the app polls).
// Opening it marks it read. Sending goes through the same safety checks
// as the website (warnings to confirm, blocks, holds).
export default function MentorChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const safety = useSafetySheet();
  const head = useApi<Convo>(`/api/conversations/${encodeURIComponent(id)}`);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Warning[] | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ messages: Msg[] }>(`/api/conversations/${encodeURIComponent(id)}/messages`);
      setMsgs(d.messages || []);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [id]);

  useEffect(() => {
    load();
    let t: ReturnType<typeof setInterval> | null = setInterval(load, POLL_MS);
    // Stop checking while the app is in the background.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        load();
        if (!t) t = setInterval(load, POLL_MS);
      } else if (t) {
        clearInterval(t);
        t = null;
      }
    });
    return () => { if (t) clearInterval(t); sub.remove(); };
  }, [load]);

  const cv = head.data?.conversation;
  const student = cv?.buyer;
  const name = student?.name || "Student";
  const blocked = !!(head.data?.safety.iBlocked || head.data?.safety.theyBlocked);
  const active = (head.data?.orders || []).filter((o) => o.kind && o.status === "IN_ESCROW");

  const send = async (ack = false) => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ message: Msg }>(`/api/conversations/${encodeURIComponent(id)}/messages`, { body: { body: text, acknowledgeWarnings: ack } });
      setMsgs((m) => [...(m || []).filter((x) => x.id !== d.message.id), d.message]);
      setDraft("");
      setWarnings(null);
    } catch (e) {
      const w = warningsOf(e);
      if (w) setWarnings(w);
      else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      scroll={false}
      footer={
        <>
          {warnings ? <WarningsCard warnings={warnings} busy={busy} onEdit={() => setWarnings(null)} onSendAnyway={() => send(true)} /> : null}
          <ErrText>{error}</ErrText>
          {blocked ? (
            <Small>{head.data?.safety.iBlocked ? `You blocked ${firstName(name)}. Unblock them to send a message.` : "You can’t message this person."}</Small>
          ) : (
            <MessageBox placeholder={`Message ${firstName(name) || "student"}`} value={draft} onChange={setDraft} onSend={() => send(false)} busy={busy} />
          )}
        </>
      }>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 10 }}>
        <Hdr title={name} sub={student?.minorStatus ? "Student · Under 18" : "Student"} />
        {student ? (
          <RowV style={{ justifyContent: "flex-end" }}>
            <Link label="Report or block" onPress={() => safety({ userId: student.id, name, conversationId: id }, () => head.reload())} />
          </RowV>
        ) : null}
        {head.error && !head.data ? <ErrorBox error={head.error} onRetry={head.reload} /> : null}
        {active.length ? (
          <View>
            {active.map((o, i) => (
              <Row key={o.id} tt={o.packageTitle || o.gig?.title} ss={`${shortHours(hoursSummary(o).left)} left`} onPress={() => router.push(`/mentor/package/${o.id}`)} last={i === active.length - 1} />
            ))}
          </View>
        ) : null}
      </View>
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 8, flexGrow: 1 }} keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
        {msgs === null ? (loadError ? <ErrorBox error={loadError} onRetry={load} /> : <Loading />) : (
          <>
            {loadError ? <Small>{loadError}</Small> : null}
            {msgs.length ? msgs.map((m) => {
              const mine = m.senderId === user?.id;
              const staff = m.sender?.role === "ADMIN";
              const text = [staff ? "MentorsMD team: " : "", m.body, m.attachmentUrl ? `${m.body ? "\n" : ""}File: ${m.attachmentName || "Attachment"} (open on mentorsmd.com)` : ""].join("");
              return <Bubble key={m.id} who={staff ? "sys" : mine ? "me" : "them"}>{text}</Bubble>;
            }) : <Bubble who="sys">No messages yet.</Bubble>}
          </>
        )}
        {blocked ? <Card tone="warn"><Note>Messages and calls between you are stopped. Booked calls can be cancelled any time.</Note></Card> : null}
      </ScrollView>
    </Screen>
  );
}
