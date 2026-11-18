import { useState } from "react";
import { Text, View } from "react-native";
import { Btn, Card, Eyebrow, FChip, Field, H, Hdr, Link, Loading, Note, Price, Row, RowV, Screen, Sec, SecH, Small, SS, Toggle, TT } from "../../components/ui";
import { BUNDLE_HOURS, ErrText, ErrorBox, FEE_PERCENT, RATE_RULE, hoursLabel, mentorShare, openSite, priceFor, useConfirm, useReloadOnFocus } from "../../components/mentorSheets";
import { api, dollars, errorText, useApi } from "../../lib/api";
import { useOverlay } from "../../lib/demo";
import { fonts } from "../../lib/theme";

type Gig = { id: string; kind: string; title: string; description: string; minutes: number | null; rateCents: number | null; price: number; active: boolean; format: string | null };
type Offers = { hourlyRateCents: number | null; hourly: Gig | null; bundles: Gig[]; packages: Gig[] };

// Rates & packages (/api/offers): the hourly rate, the Hourly offer on or
// off, hour bundles (add and remove here, POST/DELETE /api/gigs) and
// specialized packages (listed here, written and edited on mentorsmd.com).
export default function Rates() {
  const { toast, openSheet } = useOverlay();
  const confirm = useConfirm();
  const q = useApi<Offers>("/api/offers");
  useReloadOnFocus(q.reload);
  const d = q.data;
  const [rate, setRate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = d?.hourlyRateCents ?? null;
  const shown = rate ?? (current ? String(current / 100) : "");

  const saveRate = async () => {
    const v = Number(shown.trim());
    if (!Number.isInteger(v) || v < 50 || v > 2000) return setError(RATE_RULE);
    setBusy(true);
    setError(null);
    try {
      q.setData(await api<Offers>("/api/offers", { method: "PATCH", body: { rate: v } }));
      setRate(null);
      toast(`Rate saved: ${dollars(v * 100)}/hr`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const setHourly = async (active: boolean) => {
    try {
      q.setData(await api<Offers>("/api/offers", { method: "PATCH", body: { hourly: { active } } }));
      toast(active ? "Hourly is on. Students can buy single hours." : "Hourly is off");
    } catch (e) {
      toast(errorText(e));
    }
  };

  const removeBundle = (g: Gig) =>
    confirm({
      title: `Remove the ${hoursLabel(g.minutes || 0)} Bundle?`,
      body: "It disappears from your profile. Existing orders aren’t affected.",
      confirmLabel: "Remove",
      danger: true,
      onConfirm: async () => {
        await api(`/api/gigs/${encodeURIComponent(g.id)}`, { method: "DELETE" });
        q.reload();
        toast("Bundle removed");
      },
    });

  const rateOf = (g: Gig) => g.rateCents || current || 0;

  return (
    <Screen>
      <Hdr title="Rates & Packages" />
      {q.loading && !d ? <Loading /> : !d ? <ErrorBox error={q.error || "Couldn’t load your offers"} onRetry={q.reload} /> : (
        <>
          <Card>
            <Field label="Your hourly rate (USD)" value={shown} onChange={setRate} numeric placeholder="e.g. 100" />
            <Small>
              {RATE_RULE}. Students pay MentorsMD for hours at your rate.
              {current ? <> You receive <Text style={{ fontFamily: fonts.bodyBold }}>{dollars(mentorShare(current))}</Text> an hour after the {FEE_PERCENT}% MentorsMD fee.</> : null}
            </Small>
            <ErrText>{error}</ErrText>
            <Btn kind="line" sm label={busy ? "Saving…" : "Save rate"} disabled={busy} onPress={saveRate} />
          </Card>

          {d.hourly ? (
            <View>
              <Toggle tt="Hourly" ss={d.hourly.active ? "Students can buy single hours at your rate" : "Off: students can only buy your bundles and packages"} value={d.hourly.active} onChange={setHourly} last />
            </View>
          ) : null}

          <Sec>
            <SecH>
              <Eyebrow>Hour bundles</Eyebrow>
              {current ? <Link label="Add a bundle" onPress={() => openSheet(() => <AddBundleSheet rate={current} taken={d.bundles.map((b) => (b.minutes || 0) / 60)} onSaved={q.reload} />)} /> : null}
            </SecH>
            {!current ? <Note>Set your hourly rate first.</Note> : d.bundles.length ? (
              <View>
                {d.bundles.map((b, i) => (
                  <Row key={b.id} tt={hoursLabel(b.minutes || 0)} ss={`${hoursLabel(b.minutes || 0)} × ${dollars(rateOf(b))}/hr${b.rateCents ? " (own rate)" : ""} · you receive ${dollars(mentorShare(b.price))}`}
                    rr={<RowV gap={12}><Price>{dollars(b.price)}</Price><Link red label="Remove" onPress={() => removeBundle(b)} /></RowV>} last={i === d.bundles.length - 1} />
                ))}
              </View>
            ) : <Note>No bundles yet. Optional, but students like choices.</Note>}
          </Sec>

          <Sec>
            <SecH><Eyebrow>Specialized packages</Eyebrow><Link label="Add on mentorsmd.com" onPress={() => openSite("/dashboard/packages")} /></SecH>
            {d.packages.length ? d.packages.map((g) => (
              <Card key={g.id} onPress={() => openSite("/dashboard/packages")}>
                <RowV style={{ justifyContent: "space-between" }}><TT style={{ flex: 1 }}>{g.title}</TT><Price>{dollars(g.price)}</Price></RowV>
                <SS>{hoursLabel(g.minutes || 0)} × {dollars(rateOf(g))}/hr</SS>
                <SS numberOfLines={3}>{g.description}</SS>
              </Card>
            )) : <Note>No specialized packages yet. Write one on mentorsmd.com: a title, what’s included and the estimated hours.</Note>}
            <Small>Packages are written and edited on mentorsmd.com.</Small>
          </Sec>

          <Card tone="tint" onPress={() => openSite("/dashboard/offer-guide")}>
            <TT>Not Sure How To Structure Your Offers?</TT>
            <Note>Open the Offer Guide on mentorsmd.com</Note>
          </Card>
        </>
      )}
    </Screen>
  );
}

function AddBundleSheet({ rate, taken, onSaved }: { rate: number; taken: number[]; onSaved: () => void }) {
  const { closeSheet, toast } = useOverlay();
  const free = BUNDLE_HOURS.filter((h) => !taken.includes(h));
  const [hours, setHours] = useState<number>(free.includes(5) ? 5 : free[0] || 3);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!agreed) return setError("Please tick the box to accept the mentor agreement.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/gigs", { body: { kind: "BUNDLE", hours, rate: "", agreement: true } });
      closeSheet();
      toast(`Added a ${hoursLabel(hours * 60)} bundle`);
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <H>New Hour Bundle</H>
      <Small>Hours in the bundle</Small>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {BUNDLE_HOURS.map((h) => <FChip key={h} label={`${h} hours`} on={h === hours} onPress={() => (taken.includes(h) ? setError("You already have a bundle with that many hours.") : (setHours(h), setError(null)))} />)}
      </View>
      <Card tone="tint"><Note ink>Price: {hoursLabel(hours * 60)} × {dollars(rate)}/hr = {dollars(priceFor(hours * 60, rate))}. You receive {dollars(mentorShare(priceFor(hours * 60, rate)))}.</Note></Card>
      <Small>A bundle uses your hourly rate. To give it its own rate, add it on mentorsmd.com.</Small>
      <Toggle tt="I confirm this package follows the mentor agreement" ss="I give feedback (I never write the student’s essays or applications), and payments and calls stay on MentorsMD." value={agreed} onChange={setAgreed} last />
      <Link label="Read the mentor agreement" onPress={() => openSite("/mentor-agreement")} />
      <ErrText>{error}</ErrText>
      <Btn kind="dark" label={busy ? "Saving…" : "Add bundle"} disabled={busy} onPress={save} />
      <Btn kind="line" label="Cancel" onPress={closeSheet} />
    </>
  );
}
