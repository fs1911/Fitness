import Dexie, { type EntityTable } from "dexie";
import type {
  Device,
  DeviceImageBlob,
  Exercise,
  ExerciseSetting,
  MetaEntry,
  SessionExercise,
  SetEntry,
  TemplateSlot,
  UserSettings,
  WorkoutSession,
  WorkoutTemplate,
} from "@/domain/types";

export const DB_NAME = "cybex-split";

export class FitnessDB extends Dexie {
  devices!: EntityTable<Device, "id">;
  deviceImages!: EntityTable<DeviceImageBlob, "id">;
  exercises!: EntityTable<Exercise, "id">;
  exerciseSettings!: EntityTable<ExerciseSetting, "id">;
  templates!: EntityTable<WorkoutTemplate, "id">;
  templateSlots!: EntityTable<TemplateSlot, "id">;
  sessions!: EntityTable<WorkoutSession, "id">;
  sessionExercises!: EntityTable<SessionExercise, "id">;
  sets!: EntityTable<SetEntry, "id">;
  settings!: EntityTable<UserSettings, "id">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      devices: "id, muscleGroup",
      deviceImages: "id",
      exercises: "id, deviceId, muscleGroup",
      exerciseSettings: "id, exerciseId, deviceId",
      templates: "id, split",
      templateSlots: "id, templateId, exerciseId",
      sessions: "id, status, startedAt, templateId",
      sessionExercises: "id, sessionId, exerciseId",
      sets: "id, sessionId, sessionExerciseId, exerciseId, [exerciseId+deviceId]",
      settings: "id",
      meta: "key",
    });
  }

  get allTables() {
    return [
      this.devices,
      this.deviceImages,
      this.exercises,
      this.exerciseSettings,
      this.templates,
      this.templateSlots,
      this.sessions,
      this.sessionExercises,
      this.sets,
      this.settings,
      this.meta,
    ];
  }
}

export const db = new FitnessDB();

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
