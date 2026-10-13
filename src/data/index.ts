import { db as defaultDb, type FitnessDB } from "./db";
import { createBackupRepository } from "./repositories/backup";
import { createDevicesRepository } from "./repositories/devices";
import { createExercisesRepository } from "./repositories/exercises";
import { createProgressRepository } from "./repositories/progress";
import { createSessionsRepository } from "./repositories/sessions";
import { createSettingsRepository } from "./repositories/settings";
import { createTemplatesRepository } from "./repositories/templates";

/**
 * Zentrale Repository-Schicht. UI-Code greift ausschliesslich hierüber auf
 * Daten zu. Eine spätere Supabase-Synchronisierung kann hier andocken,
 * ohne dass Komponenten angepasst werden müssen.
 */
export function createRepositories(db: FitnessDB) {
  return {
    db,
    devices: createDevicesRepository(db),
    exercises: createExercisesRepository(db),
    templates: createTemplatesRepository(db),
    sessions: createSessionsRepository(db),
    settings: createSettingsRepository(db),
    backup: createBackupRepository(db),
    progress: createProgressRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export const repos = createRepositories(defaultDb);
export { defaultDb as db };
