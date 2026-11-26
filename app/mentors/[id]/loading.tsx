import { LoadingBlock } from "@/components/ui";

// Shown while a mentor's profile loads.
export default function Loading() {
  return (
    <div className="page">
      <LoadingBlock lines={4} cards={2} label="Loading profile…" />
    </div>
  );
}
