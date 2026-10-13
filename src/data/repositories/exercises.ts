import type { Exercise, ExerciseSetting, MuscleGroup } from "@/domain/types";
import { type FitnessDB, newId, nowIso } from "../db";

export interface ExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  deviceId: string;
  variantLabel?: string;
  description?: string;
}

export type SettingFields = Pick<
  ExerciseSetting,
  "seatHeight" | "startPosition" | "backrest" | "grip" | "notes"
>;

export const SETTING_LABELS: Record<keyof SettingFields, string> = {
  seatHeight: "Sitzhöhe",
  startPosition: "Startposition",
  backrest: "Rückenlehne",
  grip: "Griffposition",
  notes: "Notiz",
};

export function settingId(exerciseId: string, deviceId: string) {
  return `${exerciseId}__${deviceId}`;
}

export function settingsToText(s: Partial<SettingFields> | undefined): string {
  if (!s) return "";
  return (Object.keys(SETTING_LABELS) as (keyof SettingFields)[])
    .filter((k) => s[k]?.trim())
    .map((k) => `${SETTING_LABELS[k]}: ${s[k]!.trim()}`)
    .join(" · ");
}

export function createExercisesRepository(db: FitnessDB) {
  return {
    async list(options: { includeArchived?: boolean } = {}): Promise<Exercise[]> {
      const all = await db.exercises.toArray();
      return all
        .filter((e) => options.includeArchived || !e.archivedAt)
        .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
    },

    get(id: string) {
      return db.exercises.get(id);
    },

    byDevice(deviceId: string) {
      return db.exercises.where("deviceId").equals(deviceId).toArray();
    },

    async create(input: ExerciseInput): Promise<Exercise> {
      if (!input.name.trim()) throw new Error("Übungsname darf nicht leer sein.");
      if (!(await db.devices.get(input.deviceId))) throw new Error("Gerät nicht gefunden.");
      const now = nowIso();
      const ex: Exercise = {
        id: newId(),
        name: input.name.trim(),
        muscleGroup: input.muscleGroup,
        deviceId: input.deviceId,
        variantLabel: input.variantLabel?.trim() || undefined,
        description: input.description?.trim() || undefined,
        isSeed: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.exercises.add(ex);
      return ex;
    },

    /**
     * Ändert Stammdaten der Übung. Eine geänderte Gerätezuordnung wirkt nur
     * auf zukünftige Einheiten – historische Sätze behalten ihre deviceId.
     */
    async update(id: string, patch: Partial<ExerciseInput>) {
      const ex = await db.exercises.get(id);
      if (!ex) throw new Error("Übung nicht gefunden.");
      if (patch.name !== undefined && !patch.name.trim()) {
        throw new Error("Übungsname darf nicht leer sein.");
      }
      if (patch.deviceId && !(await db.devices.get(patch.deviceId))) {
        throw new Error("Gerät nicht gefunden.");
      }
      await db.exercises.put({
        ...ex,
        ...patch,
        name: patch.name?.trim() ?? ex.name,
        variantLabel:
          patch.variantLabel !== undefined ? patch.variantLabel.trim() || undefined : ex.variantLabel,
        updatedAt: nowIso(),
      });
    },

    async archive(id: string) {
      await db.exercises.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
    },

    getSetting(exerciseId: string, deviceId: string) {
      return db.exerciseSettings.get(settingId(exerciseId, deviceId));
    },

    async saveSetting(exerciseId: string, deviceId: string, fields: SettingFields) {
      const trimmed: SettingFields = {};
      for (const k of Object.keys(SETTING_LABELS) as (keyof SettingFields)[]) {
        const v = fields[k]?.trim();
        if (v) trimmed[k] = v;
      }
      await db.exerciseSettings.put({
        id: settingId(exerciseId, deviceId),
        exerciseId,
        deviceId,
        ...trimmed,
        updatedAt: nowIso(),
      });
    },
  };
}

export type ExercisesRepository = ReturnType<typeof createExercisesRepository>;
