import { createRepositories } from "@/data";
import { FitnessDB } from "@/data/db";
import { ensureSeeded } from "@/data/seed/seed";

let counter = 0;

/** Frische, geseedete Datenbank pro Test. */
export async function freshRepos() {
  const db = new FitnessDB(`test-${Date.now()}-${counter++}`);
  await db.open();
  await ensureSeeded(db);
  return createRepositories(db);
}

export type TestRepos = Awaited<ReturnType<typeof freshRepos>>;

/** Satz befüllen und abschliessen. */
export async function logSet(
  r: TestRepos,
  sessionExerciseId: string,
  index: number,
  weightKg: number,
  reps: number,
  extra: { isWarmup?: boolean } = {},
) {
  const sets = await r.db.sets.where("sessionExerciseId").equals(sessionExerciseId).sortBy("index");
  let set = sets[index];
  if (!set) set = await r.sessions.addSet(sessionExerciseId);
  return r.sessions.updateSet(set.id, { weightKg, reps, completed: true, isWarmup: !!extra.isWarmup });
}

export async function sessionExerciseFor(r: TestRepos, sessionId: string, exerciseId: string) {
  const list = await r.sessions.exercises(sessionId);
  const se = list.find((x) => x.exerciseId === exerciseId);
  if (!se) throw new Error(`Übung ${exerciseId} nicht in Einheit`);
  return se;
}
