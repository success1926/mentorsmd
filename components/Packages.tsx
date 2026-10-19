"use client";

// Pieces shared by the hours-package pages (redesign Oct 2026,
// docs/redesign-2026-10.md sections 4, 5 and 8): the hours meter, "Book a
// call" (from hours, or pay-per-call), "Add hours", the 48-hour decision
// banner, the package's own message thread with shared files, the hours
// log, and the mentor's "Log written work" form.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { SlotPicker } from "@/components/SlotPicker";
import { Icon, ICONS, StaffBadge } from "@/components/ui";
import { MessageText, SendWarnings, type SendWarning } from "@/components/Safety";
import { useConversation, SendError } from "@/lib/hooks/useConversation";
import { hoursSummary, shortHours, TOP_UP_HOURS } from "@/lib/hours";
import { hoursToRespond, packageStatus, studentActions } from "@/lib/finishing";
import { hoursLabel, priceFor } from "@/lib/pricing";
import { money } from "@/lib/options";
import { uploadFile } from "@/lib/upload";

export const fmtWhen = (d: string | Date) => new Date(d).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const fmtDay = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const firstName = (n?: string | null) => (n || "").split(" ")[0];

export async function postJson(url: string, body?: any): Promise<{ ok: boolean; data: any }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function PackageBadge({ order }: { order: any }) {
  const s = packageStatus(order);
  return <span className={`badge ${s.tone ? `badge-${s.tone}` : ""}`}>{s.label}</span>;
}

// Hours left, as a bar: calls used, written work used, booked (reserved), left.
export function HoursBar({ order, thin = false }: { order: any; thin?: boolean }) {
  const h = hoursSummary(order);
  const pct = (m: number) => (h.purchased ? Math.min(100, (m / h.purchased) * 100) : 0);
  return (
    <div className={`hours-bar ${thin ? "thin" : ""}`} role="img" aria-label={`${shortHours(h.left)} left of ${shortHours(h.purchased)}`}>
      <span className="seg calls" style={{ width: `${pct(h.usedCalls)}%` }} />
      <span className="seg written" style={{ width: `${pct(h.usedWritten)}%` }} />
      <span className="seg reserved" style={{ width: `${pct(h.reserved)}%` }} />
    </div>
  );
}

export function HoursMeter({ order }: { order: any }) {
  const h = hoursSummary(order);
  return (
    <div className="stack-sm">
      <div className="between" style={{ alignItems: "baseline" }}>
        <span><span className="stat-num" style={{ fontSize: 34 }}>{shortHours(h.left)}</span> <span className="text-secondary">left of {shortHours(h.purchased)}</span></span>
        <span className="text-muted small">{shortHours(h.used)} used</span>
      </div>
      <HoursBar order={order} />
      <div className="row-wrap small text-secondary" style={{ gap: 14 }}>
        <span className="row" style={{ gap: 6 }}><span className="dot calls" /> Calls {shortHours(h.usedCalls)}</span>
        <span className="row" style={{ gap: 6 }}><span className="dot written" /> Written {shortHours(h.usedWritten)}</span>
        {h.reserved > 0 && <span className="row" style={{ gap: 6 }}><span className="dot reserved" /> Booked {shortHours(h.reserved)}</span>}
        <span>Calls held: <b>{h.callsHeld}</b></span>
        {typeof order.callsRecorded === "number" && <span>Recorded: <b>{order.callsRecorded}</b></span>}
      </div>
    </div>
  );
}

// ---------- Book a call ----------

// Students pick 30 or 60 minutes, then a time. With orderId it's booked
// from that package's hours; otherwise from any package with this mentor
// that has hours left, or as a pay-per-call (Stripe) when none does.
export function BookCallModal({
  open,
  onClose,
  mentorId,
  mentorName,
  orderId,
  minutesLeft,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  mentorId: string;
  mentorName: string;
  orderId?: string;
  minutesLeft?: number; // with orderId: what's left on it
  onBooked?: () => void;
}) {
  const [minutes, setMinutes] = useState<30 | 60>(60);
  const [info, setInfo] = useState<{ packages: { id: string; title: string; left: number }[]; payPerCall: any } | null>(null);
  const [pick, setPick] = useState<string>("");
  const [done, setDone] = useState("");
  const first = firstName(mentorName) || "your mentor";

  useEffect(() => {
    if (!open) return;
    setDone("");
    if (orderId) {
      if (minutesLeft !== undefined && minutesLeft < 60 && minutesLeft >= 30) setMinutes(30);
      return;
    }
    fetch(`/api/mentors/${mentorId}/call-slots?minutes=${minutes}`)
      .then((r) => r.json())
      .then((d) => setInfo({ packages: d.packages || [], payPerCall: d.payPerCall || null }))
      .catch(() => setInfo({ packages: [], payPerCall: null }));
  }, [open, mentorId, orderId, minutes, minutesLeft]);

  // Which package pays for it (none = pay per call).
  const fitting = (info?.packages || []).filter((p) => p.left >= minutes);
  const chosen = orderId || (fitting.find((p) => p.id === pick) || fitting[0])?.id || "";
  const payPerCall = !orderId && !chosen;
  const ppc = info?.payPerCall;
  const orderTooShort = orderId && minutesLeft !== undefined && minutesLeft < minutes;

  async function confirm(startIso: string): Promise<string | null> {
    if (orderId) {
      const { ok, data } = await postJson(`/api/orders/${orderId}/calls`, { startTime: startIso, minutes });
      if (!ok) return data.error || "Couldn't book the call";
    } else {
      const { ok, data } = await postJson(`/api/mentors/${mentorId}/book-call`, { startTime: startIso, minutes, orderId: chosen || undefined });
      if (!ok) return data.error || "Couldn't book the call";
      if (data.url) {
        window.location.href = data.url; // Stripe Checkout, or the paid package
        return null;
      }
    }
    setDone(startIso);
    onBooked?.();
    return null;
  }

  return (
    <Modal open={open} onClose={onClose} label={`Book a call with ${first}`} wide>
      <div className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 24, paddingRight: 36 }}>Book a call with {first}</h2>
        {done ? (
          <div className="stack">
            <div className="alert alert-success">Booked for {fmtWhen(done)}. You&apos;ll both get an email with a calendar invite.</div>
            <button className="btn" style={{ alignSelf: "flex-start" }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="row-wrap" role="radiogroup" aria-label="Call length">
              {([30, 60] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={minutes === m} className={`btn btn-sm ${minutes === m ? "btn-primary" : ""}`} onClick={() => setMinutes(m)}>
                  {m} minutes
                </button>
              ))}
            </div>
            {orderId ? (
              orderTooShort ? (
                <div className="alert alert-warning">Only {minutesLeft} minutes are left on this package. Pick 30 minutes, or add hours first.</div>
              ) : (
                <span className="text-secondary small">Uses {minutes} minutes of this package&apos;s hours{minutesLeft !== undefined ? ` (${shortHours(minutesLeft)} left)` : ""}. No payment needed.</span>
              )
            ) : info === null ? (
              <span className="text-muted">Loading…</span>
            ) : fitting.length > 1 ? (
              <label className="stack-sm small">
                <span className="text-secondary">Use the hours from</span>
                <select className="input" value={chosen} onChange={(e) => setPick(e.target.value)} style={{ marginBottom: 0 }}>
                  {fitting.map((p) => <option key={p.id} value={p.id}>{p.title} ({shortHours(p.left)} left)</option>)}
                </select>
              </label>
            ) : fitting.length === 1 ? (
              <span className="text-secondary small">Uses {minutes} minutes from <b>{fitting[0].title}</b> ({shortHours(fitting[0].left)} left). No payment needed.</span>
            ) : ppc?.available ? (
              <div className="alert alert-blue small">
                {info.packages.length ? "Not enough hours left on your package for this call, so" : "You don't have a package with " + first + ", so"} this is a pay-per-call:{" "}
                <b>{minutes === 60 ? money(ppc.price60) : money(ppc.price30)}</b> ({money(ppc.rateCents)}/hr). Your MentorsMD credit is used first; you pay any rest on the next page, then the call is booked.
              </div>
            ) : (
              <div className="alert alert-warning small">
                {ppc ? `Message ${first} or book a free intro call first to unlock booking.` : `${first} can't take paid calls right now.`}
              </div>
            )}
            {(orderId ? !orderTooShort : chosen || ppc?.available) && (
              <SlotPicker
                key={`${minutes}-${chosen}`}
                slotsUrl={orderId ? `/api/orders/${orderId}/slots?minutes=${minutes}` : `/api/mentors/${mentorId}/call-slots?minutes=${minutes}`}
                mentorFirstName={first}
                confirmLabel={payPerCall ? "Continue to payment" : "Book"}
                onConfirm={confirm}
                onCancel={onClose}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ---------- Add hours ----------

export function AddHoursModal({ open, onClose, order }: { open: boolean; onClose: () => void; order: any }) {
  const [hours, setHours] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [credit, setCredit] = useState(0);
  useEffect(() => {
    if (!open) return;
    fetch("/api/me/credit").then((r) => r.json()).then((d) => setCredit(d.balanceCents || 0)).catch(() => {});
  }, [open]);
  const rate = order.rateCents || 0;
  const price = priceFor(hours * 60, rate);
  async function go() {
    setBusy(true);
    setError("");
    const { ok, data } = await postJson(`/api/orders/${order.id}/top-up`, { hours });
    if (ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setBusy(false);
    setError(data.error || "Couldn't start checkout. Please try again.");
  }
  return (
    <Modal open={open} onClose={onClose} label="Add hours">
      <div className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 24, paddingRight: 36 }}>Add hours</h2>
        <span className="text-secondary">At this package&apos;s rate, {money(rate)} an hour. The hours are added as soon as the payment goes through.</span>
        <div className="row-wrap" role="radiogroup" aria-label="Hours to add">
          {TOP_UP_HOURS.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={hours === h} className={`btn btn-sm ${hours === h ? "btn-primary" : ""}`} onClick={() => setHours(h)}>
              {h} hour{h === 1 ? "" : "s"}
            </button>
          ))}
        </div>
        <div className="alert alert-blue stack-sm small">
          <b>{hoursLabel(hours * 60)} × {money(rate)}/hr = {money(price)}</b>
          {credit > 0 && <span>Credit applied: {money(Math.min(credit, price))}. {credit >= price ? "Nothing to pay by card." : `You pay ${money(price - Math.min(credit, price))} by card.`}</span>}
          <span>Unused hours aren&apos;t refunded.</span>
        </div>
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <div className="row-wrap">
          <button className="btn btn-primary" disabled={busy || !rate} onClick={go}>{busy ? "Starting…" : `Add ${hours} hour${hours === 1 ? "" : "s"}`}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- The 48-hour decision ----------

export function DecisionBanner({ order, isBuyer, onChanged }: { order: any; isBuyer: boolean; onChanged: () => void }) {
  const [mode, setMode] = useState<"" | "LAST_CALL" | "LAST_REVISION" | "DISPUTE">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const left = hoursToRespond(order);
  if (left === null) return null;
  const can = studentActions(order);
  const mentor = firstName(order.seller?.name) || "Your mentor";

  if (!isBuyer) {
    return (
      <div className="alert alert-blue">
        You marked this complete. {firstName(order.buyer?.name) || "The student"} has <b>{left} hours</b> to respond; it&apos;s approved automatically after that.
      </div>
    );
  }

  async function send(action: string) {
    setBusy(true);
    setError("");
    const r =
      action === "DISPUTE"
        ? await postJson(`/api/orders/${order.id}/dispute`, { reason: note })
        : await postJson(`/api/orders/${order.id}/finish`, { action, note });
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "Something went wrong.");
    setMode("");
    setNote("");
    onChanged();
  }

  return (
    <div className="card stack decision-banner">
      <div className="stack-sm">
        <b style={{ fontSize: 18 }}>{mentor} marked this package complete</b>
        <span className="text-secondary">
          You have <b>{left} hours</b> to respond. If you don&apos;t, it&apos;s approved automatically.
          {can.lastCall ? " You can ask for one last call or one last revision (once)." : ""} Unused hours aren&apos;t refunded.
        </span>
      </div>
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      {mode ? (
        <div className="stack-sm">
          <textarea
            className="input"
            style={{ marginBottom: 0 }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "LAST_CALL" ? "What would you like to cover in the last call?" : mode === "LAST_REVISION" ? "What would you like changed?" : "Describe the problem. An admin reviews it; the package stays on hold."}
            aria-label="Details"
          />
          <div className="row-wrap">
            <button className={`btn btn-sm ${mode === "DISPUTE" ? "btn-danger" : "btn-primary"}`} disabled={busy || !note.trim()} onClick={() => send(mode)}>
              {mode === "LAST_CALL" ? "Request one last call" : mode === "LAST_REVISION" ? "Request one last revision" : "Open a dispute"}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setMode("")}>Back</button>
          </div>
          {mode === "LAST_CALL" && <span className="text-muted small">Then book the call from this page. It uses the package&apos;s hours; if none are left, add hours first.</span>}
        </div>
      ) : (
        <div className="row-wrap">
          <button className="btn btn-primary" disabled={busy} onClick={() => confirm(`Approve ${order.title || order.packageTitle}? ${mentor} is paid for the hours, including any unused ones.`) && send("APPROVE")}>Approve</button>
          {can.lastCall && <button className="btn" onClick={() => setMode("LAST_CALL")}>Request one last call</button>}
          {can.lastRevision && <button className="btn" onClick={() => setMode("LAST_REVISION")}>Request one last revision</button>}
          <button className="btn btn-ghost" style={{ color: "var(--muted)" }} onClick={() => setMode("DISPUTE")}>Open a dispute</button>
        </div>
      )}
    </div>
  );
}

// ---------- Messages + shared files for one package ----------

export function PackageThread({ order, viewerId, height = 360 }: { order: any; viewerId: string; height?: number }) {
  const { messages, sendMessage } = useConversation(order.conversationId || "", order.id);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<SendWarning[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages.length]);
  if (!order.conversationId) return null;
  const other = order.buyerId === viewerId ? order.seller : order.buyer;

  async function send(ack = false) {
    if ((!draft.trim() && !file) || sending) return;
    setSending(true);
    setError("");
    try {
      await sendMessage(draft, file || undefined, { acknowledgeWarnings: ack });
      setDraft("");
      setFile(null);
      setWarnings(null);
    } catch (err) {
      // Keep the draft; show warnings to confirm, or the problem.
      if (err instanceof SendError) {
        if (err.data?.code === "WARNING") setWarnings(err.data.warnings || []);
        else setError(err.message);
      }
    }
    setSending(false);
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="between">
        <b>Messages with {other?.name}</b>
        <Link href={`/messages/${order.conversationId}`} className="link small">All messages</Link>
      </div>
      <div ref={bodyRef} className="msg-thread ph-no-capture" style={{ maxHeight: height, overflowY: "auto" }}>
        {messages.length === 0 && <p className="text-muted">No messages on this package yet. Messages and files you send here stay with it.</p>}
        {messages.map((m: any) => (
          <div key={m.id} className={`msg-bubble ${m.senderId === viewerId ? "msg-mine" : "msg-theirs"}`}>
            {m.sender?.role === "ADMIN" && <div style={{ marginBottom: 4 }}><StaffBadge /></div>}
            <MessageText text={m.body} />
            {m.attachmentUrl && (
              <div style={{ marginTop: m.body ? 6 : 0 }}>
                <a href={`/api/files/message/${m.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", fontSize: 13 }}>📎 {m.attachmentName || "Attachment"}</a>
              </div>
            )}
          </div>
        ))}
      </div>
      {file && <div className="between text-muted small">📎 {file.name}<button onClick={() => setFile(null)} className="btn btn-sm">Remove</button></div>}
      {warnings && <SendWarnings warnings={warnings} busy={sending} onEdit={() => setWarnings(null)} onSendAnyway={() => send(true)} />}
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <div className="row">
        <input type="file" ref={fileRef} style={{ display: "none" }} accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button onClick={() => fileRef.current?.click()} className="btn btn-ghost" aria-label="Share a file (PDF or Word, up to 10 MB)" title="Share a file (PDF or Word, up to 10 MB)">📎</button>
        <textarea
          className="input grow"
          rows={1}
          style={{ marginBottom: 0, minHeight: 46, resize: "none" }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Write a message…"
          aria-label="Message"
        />
        <button onClick={() => send()} disabled={sending} className="btn btn-primary">Send</button>
      </div>
    </div>
  );
}

export function SharedFiles({ files, viewerId }: { files: any[]; viewerId: string }) {
  if (!files?.length) return <span className="text-muted small">No files shared yet. Attach a PDF or Word file to a message on this package.</span>;
  return (
    <div className="stack-sm">
      {files.map((f) => (
        <a key={f.id} href={`/api/files/message/${f.id}`} target="_blank" rel="noopener noreferrer" className="between small link-row">
          <span className="row" style={{ gap: 8, minWidth: 0 }}><Icon d={ICONS.doc} size={16} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.attachmentName || "File"}</span></span>
          <span className="text-muted nowrap">{f.senderId === viewerId ? "You" : "Them"} · {fmtDay(f.createdAt)}</span>
        </a>
      ))}
    </div>
  );
}

// ---------- Hours log ----------

export function HoursLog({ entries }: { entries: any[] }) {
  const list = entries || [];
  if (!list.length) return <span className="text-muted small">Nothing logged yet. Held calls are added automatically; your mentor logs written work here.</span>;
  return (
    <div className="stack-sm">
      {list.map((e) => (
        <div key={e.id} className="list-row" style={{ alignItems: "flex-start", opacity: e.voidedAt ? 0.55 : 1 }}>
          <span className={`badge ${e.type === "CALL" ? "badge-brand" : "badge-blue"}`}>{e.type === "CALL" ? "Call" : "Written"}</span>
          <div className="grow stack-sm" style={{ gap: 2 }}>
            <span className="small"><b>{e.minutes} min</b> · {fmtDay(e.workDate)}{e.loggedBy?.name ? ` · logged by ${e.loggedBy.name}` : e.type === "CALL" ? " · added automatically" : ""}</span>
            {e.note && <span className="text-secondary small" style={{ whiteSpace: "pre-wrap" }}>{e.note}</span>}
            {e.fileUrl && <a className="link small" href={`/api/files/hours/${e.id}`} target="_blank" rel="noopener noreferrer">📎 {e.fileName || "File"}</a>}
            {e.voidedAt && <span className="text-muted small">Taken back (doesn&apos;t count)</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Mentor: log written work ----------

export function LogWrittenWork({ order, onLogged }: { order: any; onLogged: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [minutes, setMinutes] = useState<30 | 60>(60);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const left = hoursSummary(order).left;

  async function save() {
    setBusy(true);
    setError("");
    try {
      let up: { path: string; name: string } | null = null;
      if (file) up = await uploadFile("/api/upload", file, { orderId: order.id });
      const { ok, data } = await postJson(`/api/orders/${order.id}/hours`, { minutes, workDate: day, note, fileUrl: up?.path, fileName: up?.name });
      if (!ok) throw new Error(data.error || "Couldn't log it");
      setNote("");
      setFile(null);
      onLogged();
    } catch (e: any) {
      setError(e.message || "Couldn't log it");
    }
    setBusy(false);
  }

  if (left < 30) return <span className="text-muted small">No hours left to log. The student can add hours.</span>;
  return (
    <div className="stack-sm">
      <div className="row-wrap">
        {([30, 60] as const).map((m) => (
          <button key={m} type="button" aria-pressed={minutes === m} disabled={m > left} className={`btn btn-sm ${minutes === m ? "btn-primary" : ""}`} onClick={() => setMinutes(m)}>
            {m} min
          </button>
        ))}
        <input type="date" className="input" style={{ marginBottom: 0, width: "auto" }} value={day} max={today} onChange={(e) => setDay(e.target.value)} aria-label="Day the work was done" />
      </div>
      <textarea className="input" style={{ marginBottom: 0 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you worked on, e.g. Edited the second draft of the personal statement." aria-label="Note" />
      <div className="row-wrap">
        <input type="file" ref={fileRef} style={{ display: "none" }} accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button className="btn btn-sm btn-ghost" onClick={() => fileRef.current?.click()}>📎 {file ? file.name : "Attach a file (optional)"}</button>
        <button className="btn btn-sm btn-deep" disabled={busy || note.trim().length < 3 || minutes > left} onClick={save}>{busy ? "Saving…" : `Log ${minutes} minutes`}</button>
      </div>
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <span className="text-muted small">{shortHours(left)} left to log (booked calls count as used). The student gets an email.</span>
    </div>
  );
}
