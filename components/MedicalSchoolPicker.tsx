"use client";

import { useId } from "react";
import { MEDICAL_SCHOOLS, MEDICAL_SCHOOL_MAX } from "@/lib/medicalSchools";

// Medical school picker (#85): type to search the list of US MD and DO
// schools; a school that isn't listed can simply be typed in full.
export function MedicalSchoolPicker({
  value,
  onChange,
  label = "Medical school",
  help = "Start typing and pick your school. Not listed? Type its full name.",
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  help?: string;
  required?: boolean;
}) {
  const id = useId();
  const listId = `${id}-schools`;
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </span>
      <input
        className="input"
        list={listId}
        value={value}
        maxLength={MEDICAL_SCHOOL_MAX}
        placeholder="e.g. University of Michigan Medical School"
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      <datalist id={listId}>
        {MEDICAL_SCHOOLS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}
