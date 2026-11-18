import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { LoadError, useRefresh } from "../../../components/shared";
import { Btn, Bubble, Composer, Field, Hdr, Loading, Note, Screen, Select, Small } from "../../../components/ui";
import { api, errorText, useApi } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useOverlay } from "../../../lib/demo";
import { fmtWhen, pkgTitle, type Pkg } from "../../../lib/orders";
import { useColors } from "../../../lib/theme";

const REASONS = ["The work is not what we agreed on", "My mentor missed a call", "My mentor stopped replying", "Something else"];
type DMsg = { id: string; body: string; createdAt: string; sender: { id: string; name: string; role: string } };

// Open a dispute on a package (/api/orders/[id]/dispute), then talk to the
// MentorsMD team about it (/api/orders/[id]/dispute-messages).
export default function Dispute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<{ order: Pkg }>(`/api/orders/${encodeURIComponent(id)}`);
  const o = q.data?.order;
  if (!o)
    return (
      <Screen>
        <Hdr title="Dispute" />
        {q.loading ? <Loading /> : q.error ? <LoadError error={q.error} onRetry={q.reload} title="Couldn’t load this package" /> : null}
      </Screen>
    );
  return o.disputed ? <Thread order={o} /> : <OpenDispute order={o} onOpened={q.reload} />;
}

function OpenDispute({ order, onOpened }: { order: Pkg; onOpened: () => void }) {
  const c = useColors();
  const { toast } = useOverlay();
  const [reason, setReason] = useState(REASONS[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/dispute`, { body: { reason: `${reason}. ${text.trim()}` } });
      toast("Dispute opened. The MentorsMD team will reply soon.");
      onOpened();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Hdr title="Open a Dispute" sub={pkgTitle(order)} />
      <Note>Message your mentor first. If that doesn’t sort it out, a MentorsMD admin reviews it and decides; the package is on hold meanwhile. Refunds on packages come back as MentorsMD credit you can use with any mentor.</Note>
      <Select label="What went wrong?" options={REASONS} value={reason} onChange={setReason} />
      <Field label="Describe the problem" value={text} onChange={setText} multiline placeholder="What happened, and what you’d like us to do" />
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      <Btn kind="red" label={busy ? "Opening…" : "Open a dispute"} disabled={busy || !text.trim()} onPress={send} />
    </Screen>
  );
}

function Thread({ order }: { order: Pkg }) {
  const c = useColors();
  const { user } = useAuth();
  const q = useApi<{ messages: DMsg[] }>(`/api/orders/${order.id}/dispute-messages`);
  useRefresh(q.reload, 10_000);
  const [error, setError] = useState<string | null>(null);
  const open = order.status === "IN_ESCROW";
  const send = async (body: string) => {
    setError(null);
    try {
      const r = await api<{ message: DMsg }>(`/api/orders/${order.id}/dispute-messages`, { body: { body } });
      q.setData((d) => ({ messages: [...(d?.messages || []), r.message] }));
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <Screen footer={open ? <>{error ? <Small style={{ color: c.danger }}>{error}</Small> : null}<Composer placeholder="Reply to the MentorsMD team" onSend={send} /></> : undefined}>
      <Hdr title="Dispute" sub={pkgTitle(order)} />
      <Bubble who="sys">An admin reviews it and decides. Reply here if they ask for more details. Your mentor isn’t paid while it’s open.</Bubble>
      {order.disputeReason ? <Bubble who="me">{order.disputeReason}</Bubble> : null}
      {q.loading && !q.data ? <Loading /> : null}
      {q.error && !q.data ? <LoadError error={q.error} onRetry={q.reload} title="Couldn’t load the conversation" /> : null}
      <View style={{ gap: 8 }}>
        {(q.data?.messages || []).map((m) => (
          <View key={m.id} style={{ gap: 3 }}>
            <Bubble who={m.sender?.id === user?.id ? "me" : "them"}>{m.sender?.role === "ADMIN" ? `${m.sender.name}, MentorsMD team: ` : ""}{m.body}</Bubble>
            <Small style={{ alignSelf: m.sender?.id === user?.id ? "flex-end" : "flex-start", fontSize: 11 }}>{fmtWhen(m.createdAt)}</Small>
          </View>
        ))}
      </View>
      {!open ? <Note>This dispute is closed.</Note> : null}
    </Screen>
  );
}
