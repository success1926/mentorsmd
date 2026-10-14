"use client";

import { useState } from "react";
import { Applications } from "@/components/admin/sections/Applications";

export default function AdminApplicationsPage() {
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Mentor applications</h1>
        <p className="lede">People who applied to mentor. Invite sends them a mentor invite; Decline sends no email.</p>
      </div>
      {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}
      <Applications setNotice={setNotice} />
    </div>
  );
}
