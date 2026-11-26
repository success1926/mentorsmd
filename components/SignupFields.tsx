"use client";

import Link from "next/link";
import { useId } from "react";
import { Field } from "@/components/ui";

// Shared by /signup and the one-time date-of-birth form on the blocking
// screen (components/AccountGate.tsx).

export function AgreementCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check" style={{ alignItems: "flex-start" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <span className="small">
        I agree to the <Link href="/terms" target="_blank" className="link">Terms of Service</Link>, <Link href="/privacy" target="_blank" className="link">Privacy Policy</Link> and{" "}
        <Link href="/community-guidelines" target="_blank" className="link">Community Guidelines</Link>.
      </span>
    </label>
  );
}

export type ParentValues = { parentName: string; parentEmail: string; parentPhone: string };

export const EMPTY_PARENT: ParentValues = { parentName: "", parentEmail: "", parentPhone: "" };

export function parentComplete(p: ParentValues) {
  return !!p.parentName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.parentEmail.trim()) && p.parentPhone.replace(/\D/g, "").length >= 7;
}

export function ParentFields({ value, onChange, intro = true }: { value: ParentValues; onChange: (v: ParentValues) => void; intro?: boolean }) {
  const uid = useId();
  const set = (k: keyof ParentValues) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="card card-tint stack-sm" style={{ padding: 18 }}>
      <b className="small">Your parent or guardian</b>
      {intro && (
        <span className="text-secondary small">
          Because you&apos;re under 18, we&apos;ll email them a link to read our Terms and the{" "}
          <Link href="/parental-consent" target="_blank" className="link">Parental Consent form</Link> and give consent. They also get a receipt for every order.
        </span>
      )}
      <Field id={`${uid}-name`} label="Their full name">
        <input className="input" autoComplete="off" value={value.parentName} onChange={set("parentName")} />
      </Field>
      <Field id={`${uid}-email`} label="Their email">
        <input className="input" type="email" autoComplete="off" value={value.parentEmail} onChange={set("parentEmail")} />
      </Field>
      <Field id={`${uid}-phone`} label="Their phone">
        <input className="input" type="tel" autoComplete="off" value={value.parentPhone} onChange={set("parentPhone")} />
      </Field>
    </div>
  );
}
