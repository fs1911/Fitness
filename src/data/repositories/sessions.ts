import { canCompleteSet, isValidReps, isValidWeight } from "@/domain/parse";
import type {
  Device,
  Exercise,
  ExerciseSnapshot,
  SessionExercise,
  SetEntry,
  WeightBasis,
  WeightMode,
  WorkoutSession,
} from "@/domain/types";
import { basisKey, defaultWeightMode, emptyBasis } from "@/domain/weightBasis";
import { type FitnessDB, newId, nowIso } from "../db";
import { settingId, settingsToText } from "./exercises";

export class ActiveSessionExistsError extends Error {
  constructor(public sessionId: string) {
    super("Es läuft bereits ein Training.");
  }
}

export class SessionNotActiveError extends Error {
  constructor() {
    super("Dieses Training ist bereits beendet.");
  }
}

export class SetsWouldBeLostError extends Error {
  constructor() {
    super("Für diese Übung sind bereits Sätze erfasst.");
  }
}

export interface LastPerformance {
  session: WorkoutSession;
  sets: SetEntry[];
}

export type SetPatch = Partial<
  Pick<SetEntry, "weightKg" | "reps" | "completed" | "isWarmup" | "note" | "weightBasis">
>;

const ACTIVE: WorkoutSession["status"][] = ["in_progress", "paused"];

export function hasSetData(s: Pick<SetEntry, "weightKg" | "reps" | "completed" | "note">) {
  return s.completed || s.weightKg !== null || s.reps !== null || !!s.note?.trim();
}

/** Laufzeit ohne Pausen in ms. */
export function sessionElapsedMs(s: WorkoutSession, now: number = Date.now()): number {
  const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
  const pausedOpen = s.pausedAt && !s.endedAt ? now - new Date(s.pausedAt).getTime() : 0;
  return Math.max(0, end - new Date(s.startedAt).getTime() - s.pausedDurationMs - pausedOpen);
}

export function createSessionsRepository(db: FitnessDB) {
  const tables = [
    db.sessions,
    db.sessionExercises,
    db.sets,
    db.templates,
    db.templateSlots,
    db.exercises,
    db.devices,
    db.exerciseSettings,
    db.settings,
  ];

  async function buildSnapshot(
    exercise: Exercise,
    device: Device,
    targets: Pick<ExerciseSnapshot, "targetSets" | "targetRepsMin" | "targetRepsMax" | "restSeconds">,
  ): Promise<ExerciseSnapshot> {
    const setting = await db.exerciseSettings.get(settingId(exercise.id, device.id));
    return {
      exerciseName: exercise.name,
      variantLabel: exercise.variantLabel,
      deviceName: device.name,
      deviceModel: device.model,
      muscleGroup: exercise.muscleGroup,
      loadingType: device.loadingType,
      settingsText: settingsToText(setting),
      ...targets,
    };
  }

  async function loadExerciseAndDevice(exerciseId: string) {
    const exercise = await db.exercises.get(exerciseId);
    if (!exercise) throw new Error("Übung nicht gefunden.");
    const device = await db.devices.get(exercise.deviceId);
    if (!device) throw new Error(`Für „${exercise.name}“ ist kein Gerät zugeordnet.`);
    return { exercise, device };
  }

  function makeEmptySets(se: SessionExercise, device: Device, count: number, startIndex = 0): SetEntry[] {
    const now = nowIso();
    return Array.from({ length: count }, (_, i) => ({
      id: newId(),
      sessionId: se.sessionId,
      sessionExerciseId: se.id,
      exerciseId: se.exerciseId,
      deviceId: se.deviceId,
      index: startIndex + i,
      weightKg: null,
      reps: null,
      completed: false,
      isWarmup: false,
      weightBasis: emptyBasis(se.weightMode, device),
      createdAt: now,
      updatedAt: now,
    }));
  }

  async function createSessionExercise(
    sessionId: string,
    order: number,
    exerciseId: string,
    targets: Pick<ExerciseSnapshot, "targetSets" | "targetRepsMin" | "targetRepsMax" | "restSeconds">,
    extra: { slotId?: string; alternativeExerciseIds?: string[] } = {},
  ) {
    const { exercise, device } = await loadExerciseAndDevice(exerciseId);
    const now = nowIso();
    const se: SessionExercise = {
      id: newId(),
      sessionId,
      order,
      slotId: extra.slotId,
      exerciseId: exercise.id,
      deviceId: device.id,
      alternativeExerciseIds: extra.alternativeExerciseIds ?? [],
      snapshot: await buildSnapshot(exercise, device, targets),
      status: "active",
      weightMode: defaultWeightMode(device),
      createdAt: now,
      updatedAt: now,
    };
    await db.sessionExercises.add(se);
    await db.sets.bulkAdd(makeEmptySets(se, device, targets.targetSets));
    return se;
  }

  async function requireActive(sessionId: string) {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new Error("Training nicht gefunden.");
    if (!ACTIVE.includes(s.status)) throw new SessionNotActiveError();
    return s;
  }

  async function touchSession(sessionId: string) {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const now = nowIso();
    await db.sessions.update(sessionId, {
      updatedAt: now,
      ...(ACTIVE.includes(s.status) ? {} : { editedAt: now }),
    });
  }

  async function renumberOrders(sessionId: string) {
    const list = await db.sessionExercises.where("sessionId").equals(sessionId).sortBy("order");
    await Promise.all(list.map((se, i) => (se.order === i ? null : db.sessionExercises.update(se.id, { order: i }))));
  }

  async function renumberSets(sessionExerciseId: string) {
    const list = await db.sets.where("sessionExerciseId").equals(sessionExerciseId).sortBy("index");
    await Promise.all(list.map((s, i) => (s.index === i ? null : db.sets.update(s.id, { index: i }))));
  }

  const repo = {
    get(id: string) {
      return db.sessions.get(id);
    },

    async getActive(): Promise<WorkoutSession | undefined> {
      const list = await db.sessions.where("status").anyOf(ACTIVE).toArray();
      return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    },

    async listAll(): Promise<WorkoutSession[]> {
      return db.sessions.orderBy("startedAt").reverse().toArray();
    },

    exercises(sessionId: string) {
      return db.sessionExercises.where("sessionId").equals(sessionId).sortBy("order");
    },

    sets(sessionId: string) {
      return db.sets.where("sessionId").equals(sessionId).toArray();
    },

    /**
     * Startet eine Einheit aus einer Vorlage. Übungen, Geräte und Zielwerte
     * werden als Snapshot kopiert – spätere Vorlagenänderungen wirken nicht zurück.
     */
    async start(templateId: string, options: { slotChoices?: Record<string, string> } = {}) {
      return db.transaction("rw", tables, async () => {
        const active = await repo.getActive();
        if (active) throw new ActiveSessionExistsError(active.id);
        const tpl = await db.templates.get(templateId);
        if (!tpl) throw new Error("Vorlage nicht gefunden.");
        const slots = (await db.templateSlots.where("templateId").equals(templateId).sortBy("order")).filter(
          (s) => s.active,
        );
        const now = nowIso();
        const session: WorkoutSession = {
          id: newId(),
          templateId,
          split: tpl.split,
          templateName: tpl.name,
          status: "in_progress",
          startedAt: now,
          pausedDurationMs: 0,
          notes: "",
          createdAt: now,
          updatedAt: now,
        };
        await db.sessions.add(session);
        let order = 0;
        for (const slot of slots) {
          const choice = options.slotChoices?.[slot.id];
          const options_ = [slot.exerciseId, ...slot.alternativeExerciseIds];
          const exerciseId = choice && options_.includes(choice) ? choice : slot.exerciseId;
          await createSessionExercise(
            session.id,
            order++,
            exerciseId,
            {
              targetSets: slot.targetSets,
              targetRepsMin: slot.targetRepsMin,
              targetRepsMax: slot.targetRepsMax,
              restSeconds: slot.restSeconds,
            },
            {
              slotId: slot.id,
              alternativeExerciseIds: options_.filter((id) => id !== exerciseId),
            },
          );
        }
        return session;
      });
    },

    async pause(sessionId: string) {
      await db.transaction("rw", db.sessions, async () => {
        const s = await requireActive(sessionId);
        if (s.status === "paused") return;
        await db.sessions.update(sessionId, {
          status: "paused",
          pausedAt: nowIso(),
          restTimer: undefined,
          updatedAt: nowIso(),
        });
      });
    },

    async resume(sessionId: string) {
      await db.transaction("rw", db.sessions, async () => {
        const s = await requireActive(sessionId);
        if (s.status !== "paused" || !s.pausedAt) return;
        const pausedMs = Date.now() - new Date(s.pausedAt).getTime();
        await db.sessions.update(sessionId, {
          status: "in_progress",
          pausedAt: undefined,
          pausedDurationMs: s.pausedDurationMs + Math.max(0, pausedMs),
          updatedAt: nowIso(),
        });
      });
    },

    /**
     * Schliesst eine Einheit ab. Idempotent: ein zweiter Aufruf liefert `false`
     * und verändert nichts (Schutz gegen doppelte Abschlüsse).
     */
    async finish(sessionId: string, status: "completed" | "aborted"): Promise<boolean> {
      return db.transaction("rw", db.sessions, db.sets, async () => {
        const s = await db.sessions.get(sessionId);
        if (!s || !ACTIVE.includes(s.status)) return false;
        const now = Date.now();
        const extraPause = s.pausedAt ? now - new Date(s.pausedAt).getTime() : 0;
        // Vollständig leere, offene Satzzeilen entfernen – sie enthalten keine Information.
        const sets = await db.sets.where("sessionId").equals(sessionId).toArray();
        const empty = sets.filter((x) => !hasSetData(x)).map((x) => x.id);
        await db.sets.bulkDelete(empty);
        await db.sessions.update(sessionId, {
          status,
          endedAt: new Date(now).toISOString(),
          pausedAt: undefined,
          pausedDurationMs: s.pausedDurationMs + Math.max(0, extraPause),
          restTimer: undefined,
          updatedAt: nowIso(),
        });
        return true;
      });
    },

    complete(sessionId: string) {
      return repo.finish(sessionId, "completed");
    },

    abort(sessionId: string) {
      return repo.finish(sessionId, "aborted");
    },

    async updateNotes(sessionId: string, notes: string) {
      await db.sessions.update(sessionId, { notes, updatedAt: nowIso() });
      await touchSession(sessionId);
    },

    async deleteSession(sessionId: string) {
      await db.transaction("rw", db.sessions, db.sessionExercises, db.sets, async () => {
        await db.sets.where("sessionId").equals(sessionId).delete();
        await db.sessionExercises.where("sessionId").equals(sessionId).delete();
        await db.sessions.delete(sessionId);
      });
    },

    async startRestTimer(sessionId: string, seconds: number) {
      if (seconds <= 0) return;
      await db.sessions.update(sessionId, {
        restTimer: { endsAt: Date.now() + seconds * 1000, durationSec: seconds },
      });
    },

    async adjustRestTimer(sessionId: string, deltaSec: number) {
      const s = await db.sessions.get(sessionId);
      if (!s?.restTimer) return;
      await db.sessions.update(sessionId, {
        restTimer: {
          endsAt: s.restTimer.endsAt + deltaSec * 1000,
          durationSec: Math.max(0, s.restTimer.durationSec + deltaSec),
        },
      });
    },

    async clearRestTimer(sessionId: string) {
      await db.sessions.update(sessionId, { restTimer: undefined });
    },

    // ---------- Sätze ----------

    async addSet(sessionExerciseId: string): Promise<SetEntry> {
      return db.transaction("rw", db.sessionExercises, db.sets, db.devices, db.sessions, async () => {
        const se = await db.sessionExercises.get(sessionExerciseId);
        if (!se) throw new Error("Übung nicht gefunden.");
        const device = await db.devices.get(se.deviceId);
        if (!device) throw new Error("Gerät nicht gefunden.");
        const existing = await db.sets.where("sessionExerciseId").equals(sessionExerciseId).toArray();
        const nextIndex = existing.reduce((m, s) => Math.max(m, s.index + 1), 0);
        const [set] = makeEmptySets(se, device, 1, nextIndex);
        await db.sets.add(set);
        await touchSession(se.sessionId);
        return set;
      });
    },

    async removeSet(setId: string) {
      await db.transaction("rw", db.sets, db.sessions, async () => {
        const set = await db.sets.get(setId);
        if (!set) return;
        await db.sets.delete(setId);
        await renumberSets(set.sessionExerciseId);
        await touchSession(set.sessionId);
      });
    },

    async updateSet(setId: string, patch: SetPatch): Promise<SetEntry> {
      return db.transaction("rw", db.sets, db.sessions, async () => {
        const set = await db.sets.get(setId);
        if (!set) throw new Error("Satz nicht gefunden.");
        const next: SetEntry = { ...set, ...patch, updatedAt: nowIso() };
        if (next.weightKg !== null && !isValidWeight(next.weightKg)) {
          throw new Error("Ungültiges Gewicht.");
        }
        if (next.reps !== null && !isValidReps(next.reps)) {
          throw new Error("Wiederholungen müssen eine ganze Zahl ≥ 0 sein.");
        }
        if (next.completed) {
          const err = canCompleteSet(next.weightKg, next.reps);
          if (err) throw new Error(err);
        }
        if (patch.note !== undefined) next.note = patch.note.trim() || undefined;
        await db.sets.put(next);
        await touchSession(set.sessionId);
        return next;
      });
    },

    /** Gewicht, Wiederholungen und Berechnungsgrundlage des vorherigen Satzes übernehmen. */
    async copyPreviousSet(setId: string) {
      const set = await db.sets.get(setId);
      if (!set) return;
      const siblings = await db.sets.where("sessionExerciseId").equals(set.sessionExerciseId).sortBy("index");
      const prev = [...siblings].reverse().find((s) => s.index < set.index && (s.weightKg !== null || s.reps !== null));
      if (!prev) return;
      await repo.updateSet(setId, {
        weightKg: prev.weightKg,
        reps: prev.reps,
        weightBasis: structuredClone(prev.weightBasis) as WeightBasis,
        completed: false,
      });
    },

    /**
     * Letzte abgeschlossene Durchführung derselben Übung am selben Gerät –
     * unabhängig davon, aus welcher Vorlage (A oder B) sie stammt.
     */
    async lastPerformance(
      exerciseId: string,
      deviceId: string,
      excludeSessionId?: string,
    ): Promise<LastPerformance | null> {
      const sets = await db.sets.where("[exerciseId+deviceId]").equals([exerciseId, deviceId]).toArray();
      const sessionIds = [...new Set(sets.map((s) => s.sessionId))].filter((id) => id !== excludeSessionId);
      if (sessionIds.length === 0) return null;
      const sessions = (await db.sessions.bulkGet(sessionIds)).filter(
        (s): s is WorkoutSession => !!s && s.status === "completed",
      );
      const withData = sessions.filter((s) => sets.some((x) => x.sessionId === s.id && x.completed));
      if (withData.length === 0) return null;
      const last = withData.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
      return {
        session: last,
        sets: sets.filter((s) => s.sessionId === last.id).sort((a, b) => a.index - b.index),
      };
    },

    /**
     * Füllt offene Satzzeilen mit den Werten der letzten Durchführung.
     * Die Sätze bleiben offen (nicht abgeschlossen) – reiner Vorschlag.
     */
    async applyLastValues(sessionExerciseId: string): Promise<number> {
      const se = await db.sessionExercises.get(sessionExerciseId);
      if (!se) return 0;
      const device = await db.devices.get(se.deviceId);
      if (!device) return 0;
      const last = await repo.lastPerformance(se.exerciseId, se.deviceId, se.sessionId);
      if (!last) return 0;
      const currentKey = basisKey(emptyBasis(se.weightMode, device));
      const source = last.sets.filter((s) => s.completed && basisKey(s.weightBasis) === currentKey);
      if (source.length === 0) return 0;
      return db.transaction("rw", db.sets, db.sessions, db.sessionExercises, db.devices, async () => {
        let current = await db.sets.where("sessionExerciseId").equals(sessionExerciseId).sortBy("index");
        while (current.length < source.length) {
          await repo.addSet(sessionExerciseId);
          current = await db.sets.where("sessionExerciseId").equals(sessionExerciseId).sortBy("index");
        }
        let applied = 0;
        for (let i = 0; i < source.length; i++) {
          const target = current[i];
          if (target.completed) continue;
          const src = source[i];
          const basis = structuredClone(src.weightBasis) as WeightBasis;
          await db.sets.update(target.id, {
            weightKg: src.weightKg,
            reps: src.reps,
            isWarmup: src.isWarmup,
            weightBasis: src.weightBasis.mode === se.weightMode ? basis : emptyBasisWithPlates(se.weightMode, device, src),
            completed: false,
            updatedAt: nowIso(),
          });
          applied++;
        }
        return applied;
      });
    },

    /**
     * Korrektur: tauscht alle Sätze zweier Übungen derselben Einheit
     * (z. B. Werte versehentlich bei der falschen Beinpresse-Variante erfasst).
     * Zahlenwerte bleiben, die Berechnungsgrundlage wird an das Zielgerät angepasst.
     */
    async swapSets(seAId: string, seBId: string) {
      if (seAId === seBId) return;
      await db.transaction("rw", db.sets, db.sessionExercises, db.devices, db.sessions, async () => {
        const [a, b] = await db.sessionExercises.bulkGet([seAId, seBId]);
        if (!a || !b) throw new Error("Übung nicht gefunden.");
        if (a.sessionId !== b.sessionId) throw new Error("Sätze können nur innerhalb derselben Einheit getauscht werden.");
        const [devA, devB] = await db.devices.bulkGet([a.deviceId, b.deviceId]);
        if (!devA || !devB) throw new Error("Gerät nicht gefunden.");
        const setsA = await db.sets.where("sessionExerciseId").equals(a.id).sortBy("index");
        const setsB = await db.sets.where("sessionExerciseId").equals(b.id).sortBy("index");
        const now = nowIso();

        const moveTo = (s: SetEntry, target: SessionExercise, device: Device, index: number): SetEntry => {
          let weightBasis: WeightBasis = s.weightBasis;
          if (device.loadingType === "selectorized") {
            weightBasis = { mode: "block" };
          } else if (s.weightBasis.mode === "block") {
            // Der eingetragene Wert war das aufgelegte Scheibengewicht – kein Startgewicht nachträglich erfinden.
            weightBasis = { mode: "plates_total", platesKg: s.weightKg, includesStartWeight: false };
          }
          return {
            ...s,
            sessionExerciseId: target.id,
            exerciseId: target.exerciseId,
            deviceId: target.deviceId,
            index,
            weightBasis,
            updatedAt: now,
          };
        };

        await db.sets.bulkPut([
          ...setsA.map((s, i) => moveTo(s, b, devB, i)),
          ...setsB.map((s, i) => moveTo(s, a, devA, i)),
        ]);
        await db.sessionExercises.update(a.id, { weightMode: defaultWeightMode(devA), updatedAt: now });
        await db.sessionExercises.update(b.id, { weightMode: defaultWeightMode(devB), updatedAt: now });
        await touchSession(a.sessionId);
      });
    },

    // ---------- Übungen innerhalb der Einheit ----------

    async setExerciseStatus(sessionExerciseId: string, status: SessionExercise["status"]) {
      await db.sessionExercises.update(sessionExerciseId, { status, updatedAt: nowIso() });
    },

    /** Wechselt zwischen Direkteingabe und Scheibenrechner (nur Plate-loaded). */
    async setWeightMode(sessionExerciseId: string, mode: WeightMode) {
      await db.transaction("rw", db.sessionExercises, db.sets, db.devices, async () => {
        const se = await db.sessionExercises.get(sessionExerciseId);
        if (!se) return;
        const device = await db.devices.get(se.deviceId);
        if (!device) return;
        if (device.loadingType !== "plate_loaded" && mode !== "block") {
          throw new Error("Scheibenmodus nur für scheibenbeladene Geräte.");
        }
        await db.sessionExercises.update(sessionExerciseId, { weightMode: mode, updatedAt: nowIso() });
        // Nur leere Sätze erhalten die neue Grundlage; erfasste Sätze bleiben unverändert.
        const sets = await db.sets.where("sessionExerciseId").equals(sessionExerciseId).toArray();
        for (const s of sets) {
          if (!hasSetData(s)) await db.sets.update(s.id, { weightBasis: emptyBasis(mode, device) });
        }
      });
    },

    /**
     * Ersetzt die Übung einer Position oder legt eine zusätzliche an.
     * - "replace": nur ohne erfasste Sätze, ausser `discardSets` ist explizit gesetzt.
     * - "add": bisherige Übung bleibt unverändert, neue Übung wird darunter eingefügt.
     * Bereits erfasste Sätze werden nie einem anderen Gerät zugeordnet.
     */
    async switchExercise(
      sessionExerciseId: string,
      newExerciseId: string,
      mode: "replace" | "add",
      options: { discardSets?: boolean } = {},
    ): Promise<SessionExercise> {
      return db.transaction("rw", tables, async () => {
        const se = await db.sessionExercises.get(sessionExerciseId);
        if (!se) throw new Error("Übung nicht gefunden.");
        const targets = {
          targetSets: se.snapshot.targetSets,
          targetRepsMin: se.snapshot.targetRepsMin,
          targetRepsMax: se.snapshot.targetRepsMax,
          restSeconds: se.snapshot.restSeconds,
        };
        if (mode === "add") {
          const created = await createSessionExercise(se.sessionId, se.order + 0.5, newExerciseId, targets, {
            slotId: se.slotId,
          });
          await renumberOrders(se.sessionId);
          await touchSession(se.sessionId);
          return (await db.sessionExercises.get(created.id))!;
        }
        const sets = await db.sets.where("sessionExerciseId").equals(sessionExerciseId).toArray();
        if (sets.some(hasSetData) && !options.discardSets) throw new SetsWouldBeLostError();
        const { exercise, device } = await loadExerciseAndDevice(newExerciseId);
        // Variantenwechsel (z. B. Beinpresse Block ↔ Scheiben): Varianten bleiben wählbar.
        const variants = [se.exerciseId, ...se.alternativeExerciseIds];
        const isVariantSwitch = se.alternativeExerciseIds.includes(exercise.id);
        const updated: SessionExercise = {
          ...se,
          exerciseId: exercise.id,
          deviceId: device.id,
          alternativeExerciseIds: isVariantSwitch ? variants.filter((id) => id !== exercise.id) : [],
          snapshot: await buildSnapshot(exercise, device, targets),
          weightMode: defaultWeightMode(device),
          status: "active",
          updatedAt: nowIso(),
        };
        await db.sets.bulkDelete(sets.map((s) => s.id));
        await db.sessionExercises.put(updated);
        await db.sets.bulkAdd(makeEmptySets(updated, device, Math.max(1, targets.targetSets)));
        await touchSession(se.sessionId);
        return updated;
      });
    },

    async addExercise(sessionId: string, exerciseId: string): Promise<SessionExercise> {
      return db.transaction("rw", tables, async () => {
        const settings = await db.settings.get("user");
        const count = await db.sessionExercises.where("sessionId").equals(sessionId).count();
        const se = await createSessionExercise(sessionId, count, exerciseId, {
          targetSets: 3,
          targetRepsMin: 10,
          targetRepsMax: 12,
          restSeconds: settings?.defaultRestSeconds,
        });
        await touchSession(sessionId);
        return se;
      });
    },

    async removeExercise(sessionExerciseId: string) {
      await db.transaction("rw", db.sessionExercises, db.sets, db.sessions, async () => {
        const se = await db.sessionExercises.get(sessionExerciseId);
        if (!se) return;
        await db.sets.where("sessionExerciseId").equals(sessionExerciseId).delete();
        await db.sessionExercises.delete(sessionExerciseId);
        await renumberOrders(se.sessionId);
        await touchSession(se.sessionId);
      });
    },

    async moveExercise(sessionExerciseId: string, direction: -1 | 1) {
      await db.transaction("rw", db.sessionExercises, async () => {
        const se = await db.sessionExercises.get(sessionExerciseId);
        if (!se) return;
        const list = await db.sessionExercises.where("sessionId").equals(se.sessionId).sortBy("order");
        const idx = list.findIndex((x) => x.id === sessionExerciseId);
        const target = idx + direction;
        if (target < 0 || target >= list.length) return;
        [list[idx], list[target]] = [list[target], list[idx]];
        await Promise.all(list.map((x, i) => db.sessionExercises.update(x.id, { order: i })));
      });
    },
  };
  return repo;
}

/** Fallback, wenn die letzte Grundlage einen anderen Eingabemodus hatte (gleicher Basisschlüssel). */
function emptyBasisWithPlates(mode: WeightMode, device: Device, src: SetEntry): WeightBasis {
  const basis = emptyBasis(mode, device);
  if (basis.mode !== "block" && src.weightBasis.mode !== "block") {
    basis.platesKg = src.weightBasis.platesKg;
  }
  return basis;
}

export type SessionsRepository = ReturnType<typeof createSessionsRepository>;
