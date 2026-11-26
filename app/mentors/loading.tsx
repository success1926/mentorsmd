import { LoadingBlock } from "@/components/ui";

// Shown while /mentors loads (the list is read live).
export default function Loading() {
  return (
    <div className="page">
      <LoadingBlock lines={2} cards={6} label="Loading mentors…" />
    </div>
  );
}
