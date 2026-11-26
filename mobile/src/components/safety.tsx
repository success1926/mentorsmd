import { useState } from "react";
import { View } from "react-native";
import { api, errorText, useApi } from "../lib/api";
import { useOverlay } from "../lib/overlay";
import { useColors } from "../lib/theme";
import { Btn, Field, H, Icon, Link, Note, Row, Small, Toggle } from "./ui";

// Report and block, from a conversation, a package or a profile (Apple
// asks for both wherever people can write to each other). Reports go to
// Admin -> Flags on the website (app/api/reports); blocking stops messages
// and calls between the two people (app/api/blocks).
// Same list as the website's lib/reportReasons.ts.
const REASONS: [string, string][] = [
  ["GHOSTWRITING", "Offered to write, or asked me to write, an essay or application"],
  ["OFF_SITE_PAYMENT", "Asked to pay outside MentorsMD (Venmo, Zelle, PayPal, cash...)"],
  ["OFF_SITE_CONTACT", "Pushed to talk or meet outside MentorsMD"],
  ["CREDENTIALS", "Asked for my password or login details (AMCAS etc.)"],
  ["HARASSMENT", "Harassment, threats or hateful language"],
  ["INAPPROPRIATE", "Sexual or otherwise inappropriate messages"],
  ["UNCOMFORTABLE", "Asked me to do something unethical or that I'm not comfortable with"],
  ["SCAM", "Scam, fake credentials or impersonation"],
  ["SPAM", "Spam or advertising"],
  ["QUALITY", "Didn't do what was promised / unprofessional"],
  ["OTHER", "Something else"],
];

export type SafetyTarget = { userId: string; name: string; conversationId?: string; orderId?: string; messageId?: string };

export function useSafetySheet() {
  const { openSheet } = useOverlay();
  return (t: SafetyTarget, onBlocked?: (blocked: boolean) => void) => openSheet(() => <SafetySheet t={t} onBlocked={onBlocked} />);
}

function SafetySheet({ t, onBlocked }: { t: SafetyTarget; onBlocked?: (blocked: boolean) => void }) {
  const c = useColors();
  const { closeSheet, toast } = useOverlay();
  const blocks = useApi<{ iBlocked: boolean; theyBlocked: boolean }>(`/api/blocks?userId=${encodeURIComponent(t.userId)}`);
  const [step, setStep] = useState<"menu" | "report">("menu");
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iBlocked = !!blocks.data?.iBlocked;

  const toggleBlock = async () => {
    setBusy(true);
    try {
      if (iBlocked) await api(`/api/blocks?userId=${encodeURIComponent(t.userId)}`, { method: "DELETE" });
      else await api("/api/blocks", { body: { userId: t.userId } });
      onBlocked?.(!iBlocked);
      closeSheet();
      toast(iBlocked ? `${t.name} is unblocked` : `${t.name} is blocked. Neither of you can message or call the other.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!reason) return setError("Pick a reason.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/reports", { body: { subjectUserId: t.userId, reason, details: details.trim() || undefined, conversationId: t.conversationId, orderId: t.orderId, messageId: t.messageId, block } });
      if (block) onBlocked?.(true);
      closeSheet();
      toast("Thanks. The MentorsMD team will look at this.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === "report")
    return (
      <>
        <H>Report {t.name}</H>
        <Note>Only the MentorsMD team sees this. {t.name} isn’t told who reported them.</Note>
        <View>
          {REASONS.map(([v, label], i) => (
            <Row key={v} tt={label} chevron={false} last={i === REASONS.length - 1} rr={reason === v ? <Icon name="check" color={c.primary} /> : undefined} onPress={() => setReason(v)} />
          ))}
        </View>
        <Field label={reason === "OTHER" ? "What happened?" : "Anything to add? (optional)"} value={details} onChange={setDetails} multiline />
        {!iBlocked ? <Toggle tt={`Also block ${t.name}`} value={block} onChange={setBlock} last /> : null}
        {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
        <Btn kind="red" label={busy ? "Sending…" : "Send report"} disabled={busy} onPress={send} />
        <Btn kind="line" label="Back" onPress={() => setStep("menu")} />
      </>
    );

  return (
    <>
      <H>{t.name}</H>
      <View>
        <Row tt={`Report ${t.name}`} ss="Tell the MentorsMD team about a problem" onPress={() => setStep("report")} />
        <Row tt={iBlocked ? `Unblock ${t.name}` : `Block ${t.name}`} ss={iBlocked ? "Let them message you again" : "Stop messages and calls between you"} chevron={false} onPress={toggleBlock} last />
      </View>
      {error ? <Small style={{ color: c.danger }}>{error}</Small> : null}
      <Link label="Close" onPress={closeSheet} style={{ alignSelf: "center" }} />
    </>
  );
}
