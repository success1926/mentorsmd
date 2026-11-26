"use client";

import { CustomServices } from "@/components/admin/sections/CustomServices";
import { PageHeader } from "@/components/ui";

export default function AdminServicesPage() {
  return (
    <div className="page">
      <PageHeader title="Services" lede={"Custom services mentors offer under \"Other\"."} />
      <CustomServices />
    </div>
  );
}
