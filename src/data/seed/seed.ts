import { DEFAULT_PLATES_KG } from "@/domain/plates";
import { SPLIT_MUSCLE_GROUPS, type TemplateSlot, type WorkoutTemplate } from "@/domain/types";
import { type FitnessDB, newId, nowIso } from "../db";
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
const TEMPLATE_A_DESCRIPTION = "Brust, Rücken, Schultern, Bizeps, Trizeps, Bauch";
export const MIGRATION_SHOULDERS = "migration:shoulders-v1";
export const MIGRATION_HIP = "migration:hip-add-abd-v1";
export const MIGRATION_HIP_LABELS = "migration:hip-labels-v1";
export const MIGRATION_LAT_VARIANTS = "migration:lat-variants-v1";

/** Frühere Seed-Namen → nur diese werden automatisch umbenannt. */
const HIP_LABEL_UPDATES = [
  { id: "ex-hip-adduction", oldName: "Adduktoren" },
  { id: "ex-hip-abduction", oldName: "Abduktoren" },
];

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
  const seeded = await seedInitial(db);
  await applyMigrations(db);
  return seeded;
}

async function seedInitial(db: FitnessDB): Promise<boolean> {
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
          illustrationKey: e.illustrationKey,
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
          description: TEMPLATE_A_DESCRIPTION,
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

interface SeedAddition {
  /** Flag in `meta` – jede Ergänzung läuft genau einmal. */
  key: string;
  templateId: string;
  deviceIds: string[];
  /** Neue Positionen in dieser Reihenfolge, hinter `afterExerciseId` (sonst ans Ende). */
  slots: { id: string; exerciseId: string }[];
  afterExerciseId: string;
  /** Optional: erlaubte Muskelgruppen/Beschreibung der Vorlage aktualisieren. */
  template?: Partial<Pick<WorkoutTemplate, "allowedMuscleGroups" | "description">>;
}

export const SEED_ADDITIONS: SeedAddition[] = [
  {
    key: MIGRATION_SHOULDERS,
    templateId: TEMPLATE_A_ID,
    deviceIds: ["dev-shoulder-press"],
    slots: [{ id: "slot-a-9", exerciseId: "ex-shoulder-press" }],
    afterExerciseId: "ex-reverse-butterfly",
    template: { allowedMuscleGroups: SPLIT_MUSCLE_GROUPS.A, description: TEMPLATE_A_DESCRIPTION },
  },
  {
    key: MIGRATION_HIP,
    templateId: TEMPLATE_B_ID,
    deviceIds: ["dev-hip-add-abd"],
    slots: [
      { id: "slot-b-6", exerciseId: "ex-hip-adduction" },
      { id: "slot-b-7", exerciseId: "ex-hip-abduction" },
    ],
    afterExerciseId: "ex-leg-curl",
  },
];

/**
 * Ergänzt bestehende Installationen um später hinzugefügte Seed-Inhalte.
 * Jede Ergänzung läuft genau einmal (Flag in `meta`) und überschreibt keine
 * Nutzeränderungen: Fehlende Einträge werden angelegt, vorhandene bleiben,
 * bewusst entfernte Übungen werden nicht erneut eingefügt.
 */
export async function applyMigrations(db: FitnessDB): Promise<void> {
  await applyAdditions(db);
  await applyHipLabels(db);
  await applyLatVariants(db);
}

/**
 * Adduktoren/Abduktoren unterscheidbar machen: eigene Illustration mit
 * Bewegungsrichtung und eindeutiger Name. Eigene Umbenennungen bleiben.
 * Abgeschlossene Einheiten behalten ihren gespeicherten Snapshot-Namen.
 */
async function applyHipLabels(db: FitnessDB): Promise<void> {
  await db.transaction("rw", db.meta, db.exercises, async () => {
    if (await db.meta.get(MIGRATION_HIP_LABELS)) return;
    const now = nowIso();
    for (const { id, oldName } of HIP_LABEL_UPDATES) {
      const ex = await db.exercises.get(id);
      const seed = SEED_EXERCISES.find((e) => e.id === id)!;
      if (!ex) continue;
      await db.exercises.update(id, {
        illustrationKey: ex.illustrationKey ?? seed.illustrationKey,
        ...(ex.name === oldName ? { name: seed.name } : {}),
        updatedAt: now,
      });
    }
    await db.meta.put({ key: MIGRATION_HIP_LABELS, value: now });
  });
}

async function applyAdditions(db: FitnessDB): Promise<void> {
  for (const add of SEED_ADDITIONS) {
    await db.transaction(
      "rw",
      [db.meta, db.devices, db.exercises, db.templates, db.templateSlots],
      async () => {
        if (await db.meta.get(add.key)) return;
        const now = nowIso();

        for (const deviceId of add.deviceIds) {
          const d = SEED_DEVICES.find((x) => x.id === deviceId)!;
          if (await db.devices.get(d.id)) continue;
          await db.devices.add({
            id: d.id,
            brand: "Cybex",
            name: d.name,
            muscleGroup: d.muscleGroup,
            loadingType: d.loadingType,
            description: d.description,
            illustrationKey: d.illustrationKey,
            image: { kind: "illustration" },
            isSeed: true,
            createdAt: now,
            updatedAt: now,
          });
        }
        for (const { exerciseId } of add.slots) {
          const e = SEED_EXERCISES.find((x) => x.id === exerciseId)!;
          if (!(await db.exercises.get(e.id))) {
            await db.exercises.add({ ...e, isSeed: true, createdAt: now, updatedAt: now });
          }
        }

        const tpl = await db.templates.get(add.templateId);
        if (tpl) {
          if (add.template) await db.templates.update(tpl.id, { ...add.template, updatedAt: now });
          const slots = await db.templateSlots.where("templateId").equals(tpl.id).sortBy("order");
          const missing = add.slots.filter((x) => !slots.some((s) => s.exerciseId === x.exerciseId));
          if (missing.length > 0) {
            const created: TemplateSlot[] = [];
            for (const m of missing) {
              const id = (await db.templateSlots.get(m.id)) ? newId() : m.id;
              created.push(...slotsFor(tpl.id, [{ id, exerciseId: m.exerciseId }], now));
            }
            const anchor = slots.findIndex((s) => s.exerciseId === add.afterExerciseId);
            const insertAt = anchor >= 0 ? anchor + 1 : slots.length;
            const ordered = [...slots.slice(0, insertAt), ...created, ...slots.slice(insertAt)];
            await db.templateSlots.bulkAdd(created);
            await Promise.all(ordered.map((s, i) => db.templateSlots.update(s.id, { order: i })));
          }
        }

        await db.meta.put({ key: add.key, value: now });
      },
    );
  }
}

/**
 * Latzug: bestehender Eintrag wird zur Pulldown-Maschine (dort liegt die
 * bisherige Historie), klassischer Latzug am Kabelzug kommt als Alternative
 * an derselben Position dazu. Eigene Umbenennungen bleiben.
 */
async function applyLatVariants(db: FitnessDB): Promise<void> {
  await db.transaction(
    "rw",
    [db.meta, db.devices, db.exercises, db.templateSlots],
    async () => {
      if (await db.meta.get(MIGRATION_LAT_VARIANTS)) return;
      const now = nowIso();
      const seedDev = (id: string) => SEED_DEVICES.find((d) => d.id === id)!;
      const seedEx = (id: string) => SEED_EXERCISES.find((e) => e.id === id)!;

      const cableDev = seedDev("dev-lat-cable");
      if (!(await db.devices.get(cableDev.id))) {
        await db.devices.add({
          id: cableDev.id,
          brand: "Cybex",
          name: cableDev.name,
          muscleGroup: cableDev.muscleGroup,
          loadingType: cableDev.loadingType,
          description: cableDev.description,
          illustrationKey: cableDev.illustrationKey,
          image: { kind: "illustration" },
          isSeed: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (!(await db.exercises.get("ex-lat-cable"))) {
        await db.exercises.add({ ...seedEx("ex-lat-cable"), isSeed: true, createdAt: now, updatedAt: now });
      }

      const pullDev = await db.devices.get("dev-lat-pulldown");
      if (pullDev?.name === "Cybex Latzug") {
        const seed = seedDev("dev-lat-pulldown");
        await db.devices.update(pullDev.id, {
          name: seed.name,
          ...(pullDev.description === "Latzug mit Gewichtsblock." ? { description: seed.description } : {}),
          updatedAt: now,
        });
      }
      const pullEx = await db.exercises.get("ex-lat-pulldown");
      if (pullEx?.name === "Latzug") {
        await db.exercises.update(pullEx.id, { name: seedEx("ex-lat-pulldown").name, updatedAt: now });
      }

      const slots = await db.templateSlots.where("templateId").equals(TEMPLATE_A_ID).toArray();
      const latSlot = slots.find((x) => x.exerciseId === "ex-lat-pulldown" || x.exerciseId === "ex-lat-cable");
      if (latSlot) {
        const other = latSlot.exerciseId === "ex-lat-pulldown" ? "ex-lat-cable" : "ex-lat-pulldown";
        await db.templateSlots.update(latSlot.id, {
          alternativeExerciseIds: latSlot.alternativeExerciseIds.includes(other)
            ? latSlot.alternativeExerciseIds
            : [...latSlot.alternativeExerciseIds, other],
          label: latSlot.label ?? "Latzug",
          updatedAt: now,
        });
      }

      await db.meta.put({ key: MIGRATION_LAT_VARIANTS, value: now });
    },
  );
}
