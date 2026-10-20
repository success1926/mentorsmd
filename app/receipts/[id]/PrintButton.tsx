"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-sm" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
