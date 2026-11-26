"use client";

// The package page (/orders/[id]): every hours package, for the student,
// the mentor and admins. All packages since the hourly redesign have a
// `kind`; the page itself is HoursPackage.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HoursPackage } from "./HoursPackage";
import { Alert, LoadingBlock } from "@/components/ui";

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<any>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [loadError, setLoadError] = useState("");

  const loadOrder = useCallback(() => {
    fetch(`/api/orders/${orderId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setLoadError(data.error || "Package not found.");
        else {
          setOrder(data.order);
          setViewer(data.viewer);
        }
      })
      .catch(() => setLoadError("Couldn't load this package. Check your connection and try again."));
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  if (loadError)
    return (
      <div className="page-mid">
        <Alert tone="danger">{loadError}</Alert>
      </div>
    );
  if (!order || !viewer)
    return (
      <div className="page-mid">
        <LoadingBlock lines={4} cards={2} />
      </div>
    );
  return <HoursPackage order={order} viewer={viewer} reload={loadOrder} />;
}
