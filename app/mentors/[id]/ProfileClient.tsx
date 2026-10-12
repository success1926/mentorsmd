"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon, ICONS, Vetted, Rating, tintFor, initialsOf } from "@/components/ui";
import { BACKGROUNDS, FORMATS, SCHOOL_TYPES, STAGES, TURNAROUNDS, labelFor, money, serviceLabel } from "@/lib/options";

type Gig = {
  id: string;
  title: string;
  description: string;
  price: number;
  service: string | null;
  serviceOther: string | null;
  format: string | null;
  turnaround: string | null;
  callsIncluded: number;
  callLength: number | null;
};

export function ProfileClient({ seller, reviews }: { seller: any; reviews: any[] }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;
  const isBuyer = role === "BUYER";
  const first = seller.name.split(" ")[0];

  const [elig, setElig] = useState<{ canPickDueDate: boolean; reason?: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isBuyer) return;
    fetch(`/api/conversations/eligibility?sellerId=${seller.id}`)
      .then((res) => res.json())
      .then((data) => setElig({ canPickDueDate: !!data.canPickDueDate, reason: data.reason }))
      .catch(() => {});
  }, [isBuyer, seller.id]);

  const bookable = !!elig?.canPickDueDate && seller.available;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const tags = [labelFor(STAGES, seller.mentorStage), labelFor(SCHOOL_TYPES, seller.schoolType), ...(seller.backgrounds || []).map((b: string) => labelFor(BACKGROUNDS, b))].filter(Boolean);

  async function openThread(firstMessage?: string) {
    setSending(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start the conversation");
      const id = data.conversation.id;
      if (firstMessage?.trim()) {
        const sent = await fetch(`/api/conversations/${id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: firstMessage }),
        });
        if (!sent.ok) throw new Error((await sent.json().catch(() => ({}))).error || "Message failed to send");
      }
      router.push(`/messages/${id}`);
    } catch (e: any) {
      alert(e.message);
      setSending(false);
    }
  }

  const steps = [
    { label: `Message ${first}`, done: !!elig && (elig.canPickDueDate || elig.reason === "awaiting_reply") },
    { label: `${first} replies`, done: !!elig?.canPickDueDate },
    { label: "Pick a due date and pay. We hold it until you approve.", done: false },
  ];

  return (
    <div className="page">
      <Link href="/mentors" className="link small" style={{ display: "inline-block", marginBottom: 24 }}>
        ← All mentors
      </Link>

      <div className="profile-grid">
        <div className="stack-lg" style={{ gap: 40 }}>
          {/* Header */}
          <section className="row" style={{ gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            {seller.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.photoUrl} alt={seller.name} className="avatar profile-photo" style={{ objectFit: "cover" }} />
            ) : (
              <span className="avatar profile-photo" style={{ background: tintFor(seller.id) }}>{initialsOf(seller.name)}</span>
            )}
            <div className="stack grow" style={{ gap: 10 }}>
              <div className="row-wrap">
                <h1 className="page-title" style={{ fontSize: "clamp(34px, 4vw, 48px)" }}>{seller.name}</h1>
                <Vetted />
              </div>
              {seller.credential && <span style={{ fontSize: 18 }}>{seller.credential}</span>}
              <Rating avg={avg} count={reviews.length} />
              {tags.length > 0 && (
                <div className="row-wrap" style={{ gap: 6 }}>
                  {tags.map((t) => <span key={t} className="badge">{t}</span>)}
                </div>
              )}
            </div>
          </section>

          {!seller.available && (
            <div className="alert alert-warning">
              <b>{first} is away{seller.pausedUntil ? ` until ${new Date(seller.pausedUntil).toLocaleDateString(undefined, { month: "long", day: "numeric" })}` : ""}.</b>{" "}
              {seller.status === "REMOVED" ? "This profile has been removed." : seller.awayNote || "New orders are paused for now."}
            </div>
          )}

          {seller.bio && (
            <section className="stack-sm">
              <h2 style={{ fontSize: 30 }}>About {first}</h2>
              <p style={{ fontSize: 17, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{seller.bio}</p>
            </section>
          )}

          {/* Packages */}
          <section className="stack">
            <h2 style={{ fontSize: 30 }}>Packages</h2>
            {seller.gigs.length === 0 && <div className="empty">No packages yet.</div>}
            {seller.gigs.map((g: Gig) => (
              <div key={g.id} id={`pkg-${g.id}`} className="pkg-card" style={{ scrollMarginTop: 110 }}>
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <div className="stack-sm grow">
                    <b style={{ fontSize: 19 }}>{g.title}</b>
                    <div className="pkg-meta">
                      {g.service && <span className="badge badge-brand">{serviceLabel(g.service, g.serviceOther)}</span>}
                      {g.format && <span className="badge badge-blue">{labelFor(FORMATS, g.format)}</span>}
                      {g.turnaround && <span className="badge">{labelFor(TURNAROUNDS, g.turnaround)}</span>}
                      {g.callsIncluded > 0 && (
                        <span className="badge badge-pink">
                          <Icon d={ICONS.video} size={14} />
                          {g.callsIncluded} × {g.callLength} min call{g.callsIncluded > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="display nowrap" style={{ fontSize: 30 }}>{money(g.price)}</span>
                </div>
                <p className="text-secondary" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{g.description}</p>
                {g.callsIncluded > 0 && (
                  <span className="text-muted">You book the call on {first}&apos;s calendar after you pay.</span>
                )}
                <div className="row-wrap">
                  {isBuyer ? (
                    <button disabled={!bookable} onClick={() => router.push(`/gigs/${g.id}/checkout`)} className="btn btn-primary">
                      Book for {money(g.price)}
                    </button>
                  ) : status !== "loading" && !session ? (
                    <Link href={`/login?callbackUrl=/mentors/${seller.id}`} className="btn btn-primary">Log in to book</Link>
                  ) : null}
                  {isBuyer && !bookable && seller.available && (
                    <span className="text-muted">Booking unlocks once {first} replies to your message.</span>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* Reviews */}
          <section className="stack">
            <h2 style={{ fontSize: 30 }}>Reviews</h2>
            {reviews.length === 0 && <div className="empty">No reviews yet. {first} is new to MentorsMD.</div>}
            {reviews.map((r) => (
              <div key={r.id} className="card stack-sm">
                <div className="between">
                  <b>{r.author}</b>
                  <span className="text-muted">{new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
                </div>
                <span className="stars" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                {r.comment && <p style={{ lineHeight: 1.6 }}>{r.comment}</p>}
              </div>
            ))}
          </section>
        </div>

        {/* Side */}
        <aside className="sticky-side">
          <div className="card stack" style={{ boxShadow: "var(--shadow)" }}>
            <b style={{ fontSize: 19 }}>Message {first}</b>
            <span className="text-secondary">Ask anything before you book. Messaging is free.</span>
            {isBuyer ? (
              seller.available ? (
                <>
                  <textarea
                    className="input"
                    style={{ marginBottom: 0, minHeight: 110 }}
                    placeholder={`Hi ${first}, I'm applying this cycle and would love help with…`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button className="btn btn-primary btn-block" disabled={sending} onClick={() => openThread(draft)}>
                    {sending ? "Sending…" : draft.trim() ? "Send message" : "Open conversation"}
                  </button>
                </>
              ) : (
                <span className="text-secondary">{first} isn&apos;t taking new messages while away.</span>
              )
            ) : status !== "loading" && !session ? (
              <Link href={`/signup`} className="btn btn-primary btn-block">Create a free account to message</Link>
            ) : (
              <span className="text-muted">Only student accounts can message mentors.</span>
            )}
          </div>

          {isBuyer && (
            <div className="card stack-sm">
              <b>Before you book</b>
              {steps.map((s, i) => (
                <div key={i} className="row" style={{ alignItems: "flex-start", fontSize: 15 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                      background: s.done ? "var(--primary)" : "#fff",
                      color: s.done ? "#fff" : "var(--primary)",
                      border: s.done ? "none" : "2px solid var(--tint-2)",
                    }}
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  <span style={{ fontWeight: s.done ? 600 : 400 }}>{s.label}</span>
                  <span className="sr-only">{s.done ? "(done)" : "(not yet)"}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card card-tint stack-sm">
            <span className="row strong"><Icon d={ICONS.lock} size={18} /> Payment held until you approve</span>
            <span className="text-secondary" style={{ fontSize: 14 }}>
              You pay when you book and MentorsMD holds it. It&apos;s released when you approve the work, or automatically 96 hours after delivery.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
