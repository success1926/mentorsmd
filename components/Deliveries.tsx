"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { Icon, ICONS } from "@/components/ui";
import { DELIVERY_MAX_CHARS, DELIVERY_MAX_FILES, DELIVERY_MIN_CHARS, deliveryFiles } from "@/lib/deliveries";

const fmt = (d: string | Date) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// One delivery from the mentor: their note and any files. The latest one
// can show the student's actions (approve / revision / dispute) under it.
export function DeliveryCard({ delivery, latest, children }: { delivery: any; latest: boolean; children?: React.ReactNode }) {
  const files = deliveryFiles(delivery.files);
  return (
    <div className="card stack-sm" style={latest ? { borderColor: "var(--tint-2)" } : undefined}>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <b className="row" style={{ gap: 8 }}><Icon d={ICONS.doc} size={18} /> Delivery {delivery.number}</b>
        <span className="row" style={{ gap: 8 }}>
          {latest && <span className="badge badge-brand">Latest</span>}
          <span className="text-muted">{fmt(delivery.createdAt)}</span>
        </span>
      </div>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{delivery.description}</p>
      {files.length > 0 && (
        <div className="stack-sm" style={{ gap: 4 }}>
          {files.map((f, i) => (
            <a key={i} href={`${f.url}?download=1`} download={f.name} target="_blank" rel="noopener noreferrer" className="link small">
              📎 {f.name}
            </a>
          ))}
        </div>
      )}
      {children && (
        <>
          <hr className="divider" />
          {children}
        </>
      )}
    </div>
  );
}

// The "Mark work as complete" form: a required description and optional
// files. Files go up through /api/upload first (same as message
// attachments), then the delivery is saved with their links.
export function DeliverWorkModal({
  open,
  onClose,
  orderId,
  nextNumber,
  reviewHours,
  onDelivered,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  nextNumber: number;
  reviewHours: number;
  onDelivered: () => void;
}) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const len = description.trim().length;
  const ok = len >= DELIVERY_MIN_CHARS && len <= DELIVERY_MAX_CHARS;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, DELIVERY_MAX_FILES);
    if (files.length + list.length > DELIVERY_MAX_FILES) setError(`You can attach up to ${DELIVERY_MAX_FILES} files.`);
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    if (!ok || busy) return;
    setBusy(true);
    setError("");
    try {
      const uploaded: { url: string; name: string }[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${file.name}: ${data.error || "upload failed"}`);
        uploaded.push({ url: data.url, name: data.name });
      }
      const res = await fetch(`/api/orders/${orderId}/mark-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), files: uploaded }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setDescription("");
      setFiles([]);
      onClose();
      onDelivered();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} label="Deliver your work">
      <div className="stack" style={{ gap: 14 }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: 26 }}>Deliver your work</h2>
          <span className="text-secondary">
            This is Delivery {nextNumber}. The student gets {reviewHours} hours to review it. Payment is held until they approve, and releases automatically after that.
          </span>
        </div>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">What are you delivering?</span>
          <textarea
            className="input"
            rows={6}
            maxLength={DELIVERY_MAX_CHARS}
            placeholder="e.g. I've left comments throughout your personal statement and rewritten the opening paragraph. The main thing to work on next is…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={description.length > 0 && !ok}
          />
          <span className="field-help">
            {len < DELIVERY_MIN_CHARS ? `At least ${DELIVERY_MIN_CHARS} characters (${len}/${DELIVERY_MIN_CHARS}).` : `${len} characters.`}
          </span>
        </label>
        <div className="stack-sm">
          <span className="field-label">Files (optional)</span>
          <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
          {files.map((f, i) => (
            <div key={i} className="between small" style={{ gap: 8 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {f.name}</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          {files.length < DELIVERY_MAX_FILES && (
            <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => inputRef.current?.click()}>
              Add files
            </button>
          )}
          <span className="field-help">PDF, Word, images and other documents, up to 10MB each.</span>
        </div>
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <div className="row">
          <button type="button" className="btn btn-deep" disabled={!ok || busy} onClick={submit}>
            {busy ? (files.length ? "Uploading…" : "Delivering…") : "Deliver work"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
