import { prisma } from "@/lib/prisma";
import { RECORDING_RETENTION_DAYS } from "@/lib/calls";
import { dailyConfigured, deleteRecording } from "@/lib/daily";

// Recordings are deleted 60 days after the order is closed: released to
// the mentor, refunded, or the dispute resolved. Runs once a day with the
// auto-release cron. The video is deleted on Daily; our row is kept with
// deletedAt set, so the admin page shows "Deleted".
export async function cleanupRecordings(now: Date = new Date()) {
  const results = { deleted: 0, failed: 0 };
  if (!dailyConfigured()) return results;
  const cutoff = new Date(now.getTime() - RECORDING_RETENTION_DAYS * 24 * 3600_000);
  const due = await prisma.callRecording.findMany({
    where: {
      deletedAt: null,
      booking: {
        OR: [
          { order: { disputeResolvedAt: { lt: cutoff } } },
          { order: { status: "RELEASED", disputeResolvedAt: null, completedAt: { lt: cutoff } } },
          // Refunded without a dispute: count from the call itself.
          { order: { status: "REFUNDED", disputeResolvedAt: null }, endTime: { lt: cutoff } },
        ],
      },
    },
    select: { id: true, dailyRecordingId: true },
    take: 100,
  });
  for (const r of due) {
    const ok = await deleteRecording(r.dailyRecordingId).catch(() => false);
    if (ok) {
      await prisma.callRecording.update({ where: { id: r.id }, data: { deletedAt: now, status: "deleted" } });
      results.deleted++;
    } else {
      results.failed++;
    }
  }
  return results;
}
