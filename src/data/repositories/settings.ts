import { DEFAULT_PLATES_KG } from "@/domain/plates";
import type { UserSettings } from "@/domain/types";
import { type FitnessDB, nowIso } from "../db";

export const DEFAULT_SETTINGS: UserSettings = {
  id: "user",
  availablePlatesKg: DEFAULT_PLATES_KG,
  restTimerEnabled: true,
  defaultRestSeconds: 90,
  includeWarmupInVolume: false,
  updatedAt: new Date(0).toISOString(),
};

export function createSettingsRepository(db: FitnessDB) {
  return {
    async get(): Promise<UserSettings> {
      return (await db.settings.get("user")) ?? DEFAULT_SETTINGS;
    },
    async update(patch: Partial<Omit<UserSettings, "id">>) {
      if (patch.availablePlatesKg?.some((p) => !Number.isFinite(p) || p <= 0)) {
        throw new Error("Scheibengrössen müssen positive Zahlen sein.");
      }
      if (
        patch.defaultRestSeconds !== undefined &&
        (!Number.isInteger(patch.defaultRestSeconds) || patch.defaultRestSeconds < 0)
      ) {
        throw new Error("Pausenzeit: ganze Sekunden ≥ 0.");
      }
      const current = (await db.settings.get("user")) ?? DEFAULT_SETTINGS;
      const plates = patch.availablePlatesKg
        ? [...new Set(patch.availablePlatesKg)].sort((a, b) => a - b)
        : current.availablePlatesKg;
      await db.settings.put({ ...current, ...patch, availablePlatesKg: plates, updatedAt: nowIso() });
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
