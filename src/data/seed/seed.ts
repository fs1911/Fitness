import { DEFAULT_PLATES_KG } from "@/domain/plates";
import { SPLIT_MUSCLE_GROUPS, type TemplateSlot } from "@/domain/types";
import { type FitnessDB, nowIso } from "../db";
import {
  SEED_DEFAULT_TARGET,
  SEED_DEVICES,
  SEED_EXERCISES,
  SEED_TEMPLATE_A_SLOTS,
  SEED_TEMPLATE_B_SLOTS,
  type SeedSlot,
} from "./seedData";

export const SEED_VERSION = "1";
export const TEMPLATE_A_ID = "tpl-a";
export const TEMPLATE_B_ID = "tpl-b";

function slotsFor(templateId: string, slots: SeedSlot[], now: string): TemplateSlot[] {
  return slots.map((s, i) => ({
    id: s.id,
    templateId,
    order: i,
    label: s.label,
    exerciseId: s.exerciseId,
    alternativeExerciseIds: s.alternativeExerciseIds ?? [],
    targetSets: SEED_DEFAULT_TARGET.sets,
    targetRepsMin: SEED_DEFAULT_TARGET.repsMin,
    targetRepsMax: SEED_DEFAULT_TARGET.repsMax,
    restSeconds: SEED_DEFAULT_TARGET.restSeconds,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Legt beim ersten Start Geräte, Übungen, Vorlagen und Einstellungen an.
 * Idempotent: läuft in einer Transaktion und nur, wenn noch nie geseedet wurde.
 */
export async function ensureSeeded(db: FitnessDB): Promise<boolean> {
  return db.transaction(
    "rw",
    [db.meta, db.devices, db.exercises, db.templates, db.templateSlots, db.settings],
    async () => {
      const existing = await db.meta.get("seedVersion");
      if (existing) return false;
      const now = nowIso();

      await db.devices.bulkPut(
        SEED_DEVICES.map((d) => ({
          id: d.id,
          brand: "Cybex" as const,
          name: d.name,
          muscleGroup: d.muscleGroup,
          loadingType: d.loadingType,
          description: d.description,
          illustrationKey: d.illustrationKey,
          weightIncrementKg: d.weightIncrementKg,
          image: { kind: "illustration" as const },
          isSeed: true,
          createdAt: now,
          updatedAt: now,
        })),
      );

      await db.exercises.bulkPut(
        SEED_EXERCISES.map((e) => ({
          id: e.id,
          name: e.name,
          muscleGroup: e.muscleGroup,
          deviceId: e.deviceId,
          description: e.description,
          isSeed: true,
          createdAt: now,
          updatedAt: now,
        })),
      );

      await db.templates.bulkPut([
        {
          id: TEMPLATE_A_ID,
          split: "A",
          name: "Training A – Oberkörper und Bauch",
          description: "Brust, Rücken, Bizeps, Trizeps, Bauch",
          allowedMuscleGroups: SPLIT_MUSCLE_GROUPS.A,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: TEMPLATE_B_ID,
          split: "B",
          name: "Training B – Beine und Bauch",
          description: "Beine, Bauch",
          allowedMuscleGroups: SPLIT_MUSCLE_GROUPS.B,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.templateSlots.bulkPut([
        ...slotsFor(TEMPLATE_A_ID, SEED_TEMPLATE_A_SLOTS, now),
        ...slotsFor(TEMPLATE_B_ID, SEED_TEMPLATE_B_SLOTS, now),
      ]);

      if (!(await db.settings.get("user"))) {
        await db.settings.put({
          id: "user",
          availablePlatesKg: DEFAULT_PLATES_KG,
          restTimerEnabled: true,
          defaultRestSeconds: 90,
          includeWarmupInVolume: false,
          updatedAt: now,
        });
      }

      await db.meta.put({ key: "seedVersion", value: SEED_VERSION });
      return true;
    },
  );
}
