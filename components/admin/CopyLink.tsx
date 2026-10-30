"use client";

import { useEffect, useRef, useState } from "react";

// An invite link shown when its email didn't go out: the link in a
// read-only box (selected on click) and a Copy button that says "Copied"
// for a couple of seconds.
export function CopyLink({ link, label = "Invite link" }: { link: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard blocked (old browser or no permission): select it so they can copy by hand.
      box.current?.select();
    }
  }
  return (
    <div className="adm-copy">
      <input ref={box} className="input" readOnly value={link} onFocus={(e) => e.target.select()} aria-label={label} />
      <button type="button" className="btn btn-sm" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
