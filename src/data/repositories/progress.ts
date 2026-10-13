import { buildProgressSeries, type ProgressSeries, type SessionInfo } from "@/domain/metrics";
import type { FitnessDB } from "../db";

export function createProgressRepository(db: FitnessDB) {
  return {
    /** Vergleichbare Reihen einer Übung (je Gerät und Berechnungsgrundlage getrennt). */
    async seriesForExercise(
      exerciseId: string,
      options: { includeWarmup?: boolean } = {},
    ): Promise<ProgressSeries[]> {
      const sets = await db.sets.where("exerciseId").equals(exerciseId).toArray();
      const sessionIds = [...new Set(sets.map((s) => s.sessionId))];
      const sessions = (await db.sessions.bulkGet(sessionIds)).filter((s) => !!s);
      const info = new Map<string, SessionInfo>(
        sessions.map((s) => [s!.id, { id: s!.id, startedAt: s!.startedAt, status: s!.status }]),
      );
      return buildProgressSeries(sets, info, options);
    },

    /** IDs aller Übungen mit mindestens einem abgeschlossenen Satz in einer abgeschlossenen Einheit. */
    async exercisesWithHistory(): Promise<Set<string>> {
      const completed = await db.sessions.where("status").equals("completed").primaryKeys();
      const ids = new Set<string>();
      if (completed.length === 0) return ids;
      const sets = await db.sets.where("sessionId").anyOf(completed as string[]).toArray();
      for (const s of sets) if (s.completed) ids.add(s.exerciseId);
      return ids;
    },
  };
}

export type ProgressRepository = ReturnType<typeof createProgressRepository>;
