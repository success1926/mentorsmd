"use client";

import { useEffect, useState } from "react";

const CATEGORIES = [
  { value: "ESSAY_REVIEW", label: "Essay review" },
  { value: "MOCK_INTERVIEW", label: "Mock interview" },
  { value: "APPLICATION_STRATEGY", label: "Application strategy" },
  { value: "TUTORING", label: "Tutoring" },
  { value: "OTHER", label: "Other" },
];

const emptyForm = { title: "", description: "", price: "", duration: "", category: "OTHER" };

export default function DashboardPage() {
  const [gigs, setGigs] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function load() {
    // mine=true is what limits this to the logged-in seller's own
    // packages, rather than every seller's packages on the site.
    fetch("/api/gigs?mine=true")
      .then((res) => res.json())
      .then((data) => setGigs(data.gigs || []));
  }

  useEffect(load, []);

  async function submitNew() {
    if (!form.title.trim()) return;
    await fetch("/api/gigs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(emptyForm);
    setAdding(false);
    load();
  }

  async function saveEdit(id: string) {
    await fetch(`/api/gigs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/gigs/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(g: any) {
    setEditingId(g.id);
    setForm({ title: g.title, description: g.description, price: (g.price / 100).toString(), duration: g.duration, category: g.category });
  }

  const categoryLabel = (value: string) => CATEGORIES.find((c) => c.value === value)?.label || value;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>My packages</h1>
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {gigs.length === 0 && <p className="text-muted">No packages yet — add your first one below.</p>}
        {gigs.map((g) => (
          <div key={g.id} className="card">
            {editingId === g.id ? (
              <div>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" />
                <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
                <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <input className="input" style={{ marginBottom: 0 }} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price ($)" />
                  <input className="input" style={{ marginBottom: 0 }} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Turnaround" />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => saveEdit(g.id)} className="btn" style={{ background: "#1E5631", border: "none", color: "#fff" }}>Save</button>
                  <button onClick={() => setEditingId(null)} className="btn">Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontWeight: 600 }}>{g.title}</div>
                    <span className="badge" style={{ background: "#EAF0EC", color: "#33413A" }}>{categoryLabel(g.category)}</span>
                  </div>
                  <p className="text-secondary" style={{ marginBottom: 8 }}>{g.description}</p>
                  <div className="text-muted">{g.duration}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>${(g.price / 100).toFixed(0)}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(g)} className="btn">Edit</button>
                    <button onClick={() => remove(g.id)} className="btn btn-danger">Remove</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="card">
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Package title" />
          <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's included" />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <input className="input" style={{ marginBottom: 0 }} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price ($)" />
            <input className="input" style={{ marginBottom: 0 }} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Turnaround" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submitNew} className="btn" style={{ background: "#1E5631", border: "none", color: "#fff" }}>Add package</button>
            <button onClick={() => setAdding(false)} className="btn">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setForm(emptyForm); setAdding(true); }} className="btn" style={{ width: "100%", borderStyle: "dashed" }}>
          Add a package
        </button>
      )}
    </div>
  );
}
