// The badge for a cycle result's status (lib/cycleResults.ts), the same on
// the student's Cycle results page and Admin -> Cycle results.
export function resultBadgeClass(status: string) {
  if (status === "ACCEPTED" || status === "MATRICULATING") return "badge badge-success";
  if (status === "REJECTED") return "badge badge-pink";
  return "badge badge-brand";
}
