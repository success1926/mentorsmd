"use client";

import { CustomServices } from "@/components/admin/sections/CustomServices";

export default function AdminServicesPage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Services</h1>
        <p className="lede">Custom services mentors offer under &quot;Other&quot;.</p>
      </div>
      <CustomServices />
    </div>
  );
}
