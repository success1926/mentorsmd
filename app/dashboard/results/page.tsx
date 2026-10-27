import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CYCLE_RESULTS_ON } from "@/lib/cycleResults";
import { ResultsEditor } from "./ResultsEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cycle results", robots: { index: false } };

// Cycle results (lib/cycleResults.ts): a student's application outcomes,
// school by school. "Page not found" while NEXT_PUBLIC_CYCLE_RESULTS isn't 1,
// and for anyone but students.
export default async function CycleResultsPage() {
  if (!CYCLE_RESULTS_ON) notFound();
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "BUYER") notFound();
  return (
    <div className="page-mid stack-lg" style={{ gap: 24 }}>
      <div className="stack-sm">
        <h1 className="page-title">Cycle results</h1>
        <p className="lede">Keep track of every school you applied to this cycle, and which MentorsMD mentors helped. Only you and the MentorsMD team can see this.</p>
      </div>
      <ResultsEditor />
    </div>
  );
}
