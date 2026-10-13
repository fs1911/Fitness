import type { TemplateSlot, WorkoutTemplate } from "@/domain/types";
import { type FitnessDB, newId, nowIso } from "../db";

export interface SlotInput {
  exerciseId: string;
  label?: string;
  alternativeExerciseIds?: string[];
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSeconds?: number;
  active?: boolean;
}

function validateSlot(s: Partial<SlotInput>) {
  const ints: [string, number | undefined][] = [
    ["Zielsätze", s.targetSets],
    ["Wiederholungen (min.)", s.targetRepsMin],
    ["Wiederholungen (max.)", s.targetRepsMax],
    ["Pausenzeit", s.restSeconds],
  ];
  for (const [label, v] of ints) {
    if (v !== undefined && (!Number.isInteger(v) || v < 0)) {
      throw new Error(`${label}: bitte eine ganze Zahl ≥ 0 eingeben.`);
    }
  }
  if (s.targetSets !== undefined && (s.targetSets < 1 || s.targetSets > 20)) {
    throw new Error("Zielsätze: 1 bis 20.");
  }
  if (
    s.targetRepsMin !== undefined &&
    s.targetRepsMax !== undefined &&
    s.targetRepsMin > s.targetRepsMax
  ) {
    throw new Error("Minimale Wiederholungen dürfen nicht grösser als die maximalen sein.");
  }
}

export function createTemplatesRepository(db: FitnessDB) {
  async function assertAllowed(templateId: string, exerciseIds: string[]) {
    const tpl = await db.templates.get(templateId);
    if (!tpl) throw new Error("Vorlage nicht gefunden.");
    for (const id of exerciseIds) {
      const ex = await db.exercises.get(id);
      if (!ex) throw new Error("Übung nicht gefunden.");
      if (!tpl.allowedMuscleGroups.includes(ex.muscleGroup)) {
        throw new Error(`„${ex.name}“ passt nicht zu den Muskelgruppen von ${tpl.name}.`);
      }
    }
  }

  async function normalizeOrder(templateId: string) {
    const slots = await db.templateSlots.where("templateId").equals(templateId).sortBy("order");
    await Promise.all(slots.map((s, i) => (s.order === i ? null : db.templateSlots.update(s.id, { order: i }))));
  }

  return {
    async list(): Promise<WorkoutTemplate[]> {
      return (await db.templates.toArray()).sort((a, b) => a.split.localeCompare(b.split));
    },

    get(id: string) {
      return db.templates.get(id);
    },

    slots(templateId: string): Promise<TemplateSlot[]> {
      return db.templateSlots.where("templateId").equals(templateId).sortBy("order");
    },

    async addSlot(templateId: string, input: SlotInput): Promise<TemplateSlot> {
      validateSlot(input);
      await assertAllowed(templateId, [input.exerciseId, ...(input.alternativeExerciseIds ?? [])]);
      return db.transaction("rw", db.templateSlots, db.templates, db.exercises, async () => {
        const count = await db.templateSlots.where("templateId").equals(templateId).count();
        const now = nowIso();
        const slot: TemplateSlot = {
          id: newId(),
          templateId,
          order: count,
          label: input.label?.trim() || undefined,
          exerciseId: input.exerciseId,
          alternativeExerciseIds: input.alternativeExerciseIds ?? [],
          targetSets: input.targetSets,
          targetRepsMin: input.targetRepsMin,
          targetRepsMax: input.targetRepsMax,
          restSeconds: input.restSeconds,
          active: input.active ?? true,
          createdAt: now,
          updatedAt: now,
        };
        await db.templateSlots.add(slot);
        await db.templates.update(templateId, { updatedAt: now });
        return slot;
      });
    },

    async updateSlot(slotId: string, patch: Partial<SlotInput>) {
      const slot = await db.templateSlots.get(slotId);
      if (!slot) throw new Error("Übungsposition nicht gefunden.");
      const merged = { ...slot, ...patch };
      validateSlot(merged);
      await assertAllowed(slot.templateId, [merged.exerciseId, ...merged.alternativeExerciseIds]);
      await db.templateSlots.put({
        ...merged,
        alternativeExerciseIds: merged.alternativeExerciseIds.filter((id) => id !== merged.exerciseId),
        label: merged.label?.trim() || undefined,
        updatedAt: nowIso(),
      });
      await db.templates.update(slot.templateId, { updatedAt: nowIso() });
    },

    async removeSlot(slotId: string) {
      const slot = await db.templateSlots.get(slotId);
      if (!slot) return;
      await db.transaction("rw", db.templateSlots, db.templates, async () => {
        await db.templateSlots.delete(slotId);
        await normalizeOrder(slot.templateId);
        await db.templates.update(slot.templateId, { updatedAt: nowIso() });
      });
    },

    /** Verschiebt eine Position um eins nach oben (-1) oder unten (+1). */
    async moveSlot(slotId: string, direction: -1 | 1) {
      await db.transaction("rw", db.templateSlots, db.templates, async () => {
        const slot = await db.templateSlots.get(slotId);
        if (!slot) return;
        const slots = await db.templateSlots.where("templateId").equals(slot.templateId).sortBy("order");
        const idx = slots.findIndex((s) => s.id === slotId);
        const target = idx + direction;
        if (target < 0 || target >= slots.length) return;
        [slots[idx], slots[target]] = [slots[target], slots[idx]];
        await Promise.all(slots.map((s, i) => db.templateSlots.update(s.id, { order: i })));
        await db.templates.update(slot.templateId, { updatedAt: nowIso() });
      });
    },
  };
}

export type TemplatesRepository = ReturnType<typeof createTemplatesRepository>;
