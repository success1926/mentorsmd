import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SettingsBody } from "../../components/shared";
import { Btn, Card, Chip, Eyebrow, Field, Grow, H, Hdr, Link, Loading, Note, Screen, Sec, Small, SS, Toggle, TT } from "../../components/ui";
import { DayGrid, ErrText, ErrorBox, dayString, fmtDayString, useReloadOnFocus } from "../../components/mentorSheets";
import { api, errorText, useApi } from "../../lib/api";
import { useOverlay } from "../../lib/demo";

type Profile = { profileStatus: string; pausedUntil: string | null; awayNote: string | null; acceptsMinors: boolean | null; removedByAdmin?: boolean };

// Mentor settings, like the website's /dashboard/settings: pause my profile
// (with an optional return date and note), students under 18, the Stripe
// account, remove / restore my profile, then the shared sign-in settings.
// Pause / remove use /api/profile/availability; under 18 uses PATCH /api/profile.
export default function MentorSettings() {
  const router = useRouter();
  const { toast, openSheet } = useOverlay();
  const q = useApi<{ profile: Profile }>("/api/profile");
  const st = useApi<{ connected: boolean; started: boolean }>("/api/stripe/status");
  useReloadOnFocus(() => { q.reload(); st.reload(); });
  const [busy, setBusy] = useState(false);
  const p = q.data?.profile;
  const status = p?.profileStatus;
  const pausedNow = status === "PAUSED" && !(p?.pausedUntil && new Date(p.pausedUntil) <= new Date());
  const minorsOn = p?.acceptsMinors !== false;

  const availability = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      await api("/api/profile/availability", { body });
      toast(ok);
      q.reload();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const setMinors = async (on: boolean) => {
    if (!p) return;
    setBusy(true);
    q.setData({ profile: { ...p, acceptsMinors: on } });
    try {
      await api("/api/profile", { method: "PATCH", body: { acceptsMinors: on } });
      toast(on ? "Saved. Students under 18 can message and book you." : "Saved. Students under 18 can't message or book you.");
    } catch (e) {
      q.setData({ profile: { ...p } });
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Hdr title="Settings" />
      {q.loading && !p ? <Loading /> : !p ? <ErrorBox error={q.error || "Couldn’t load your settings"} onRetry={q.reload} /> : (
        <>
          {status !== "REMOVED" ? (
            <Sec>
              <View>
                <Toggle tt="Pause my profile" ss="Students won’t see you on Browse and can’t book you. Orders you already have keep going, and you can still message students." value={pausedNow}
                  onChange={(v) => { if (!busy) availability(v ? { action: "pause" } : { action: "unpause" }, v ? "Paused. You’re hidden from search." : "You’re visible again."); }} />
                <Toggle tt="Work with students under 18" ss="Students aged 13 to 17 can use MentorsMD with a parent or guardian’s consent. Turn this off to only work with students 18 and over (orders you already have aren’t affected)." value={minorsOn}
                  onChange={(v) => { if (!busy) setMinors(v); }} last />
              </View>
              {pausedNow ? (
                <Card tone="tint">
                  <TT>{p.pausedUntil ? `Back on ${new Date(p.pausedUntil).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : "Paused until you switch it off"}</TT>
                  {p.awayNote ? <Note ink>“{p.awayNote}”</Note> : null}
                  <Link label="Set a return date or note" onPress={() => openSheet(() => <PauseSheet p={p} onSaved={q.reload} />)} />
                  <Small>Your profile comes back automatically on the date you pick, or when you switch this off.</Small>
                </Card>
              ) : null}
            </Sec>
          ) : (
            <Card tone="warn">
              <TT>Your profile is removed</TT>
              <Note>Your profile and packages are off the site. You can still finish active orders and get paid for them.</Note>
              {!p.removedByAdmin ? <Btn kind="dark" label="Restore my profile" disabled={busy} onPress={() => availability({ action: "restore" }, "Welcome back. Your profile is live again.")} /> : <Note>Your profile was removed by MentorsMD. Contact us to discuss it.</Note>}
            </Card>
          )}

          <Card row onPress={() => router.push("/mentor/payouts")}>
            <Grow><TT>Stripe account</TT><SS>Bank details are managed on Stripe.</SS></Grow>
            {st.data ? <Chip label={st.data.connected ? "Connected" : st.data.started ? "Not finished" : "Not connected"} tone={st.data.connected ? "ok" : "warn"} /> : <SS>Checking…</SS>}
          </Card>

          {status !== "REMOVED" ? (
            <Sec>
              <Eyebrow>Leaving MentorsMD?</Eyebrow>
              <Link red label="Remove my profile" onPress={() => openSheet(() => <RemoveSheet onDone={q.reload} />)} />
              <Small>Your profile and packages come off the site. If you only need a break, pausing is easier to undo.</Small>
            </Sec>
          ) : null}
        </>
      )}
      <SettingsBody role="mentor" />
    </Screen>
  );
}

function PauseSheet({ p, onSaved }: { p: Profile; onSaved: () => void }) {
  const { closeSheet, toast } = useOverlay();
  const [day, setDay] = useState<string | null>(p.pausedUntil ? dayString(new Date(p.pausedUntil)) : null);
  const [note, setNote] = useState(p.awayNote || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/profile/availability", { body: { action: "pause", pausedUntil: day ? `${day}T12:00:00.000Z` : null, awayNote: note.trim() } });
      closeSheet();
      toast(day ? "Saved. You’ll be visible again on your return date." : "Saved.");
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <H>Taking a Break</H>
      <Small>Back on (optional)</Small>
      <DayGrid start={day} minDay={dayString(new Date(Date.now() + 86400000))} onChange={(s) => setDay(s === day ? null : s)} />
      <SS>{day ? `Back on ${fmtDayString(day)}. Tap it again to clear.` : "No return date: you come back when you switch Pause off."}</SS>
      <Field label="Note on your profile (optional)" value={note} onChange={setNote} placeholder="On rotations until November, back soon!" />
      <ErrText>{error}</ErrText>
      <Btn kind="dark" label={busy ? "Saving…" : "Save"} disabled={busy} onPress={save} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}

function RemoveSheet({ onDone }: { onDone: () => void }) {
  const { closeSheet, toast } = useOverlay();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/profile/availability", { body });
      closeSheet();
      toast(ok);
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <H>Remove My Profile?</H>
      <Note>Are you sure? If you only need a break, pausing is easier to undo. Your messages and order history stay available, and you still finish active orders and get paid for them.</Note>
      <Field label="Anything we should know? (optional)" value={reason} onChange={setReason} multiline />
      <ErrText>{error}</ErrText>
      <Btn kind="red" label="Yes, remove my profile" disabled={busy} onPress={() => go({ action: "remove", reason: reason.trim() }, "Your profile has been removed.")} />
      <Btn kind="dark" label="Pause instead" disabled={busy} onPress={() => go({ action: "pause" }, "Paused instead. You’re hidden from search.")} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}
