import { z } from "zod";
import { formatDate, formatTime } from "@/domain/format";
import { MUSCLE_GROUPS, SESSION_STATUS_LABELS } from "@/domain/types";
import type { FitnessDB } from "../db";
import { nowIso } from "../db";
import { describeBasis } from "@/domain/weightBasis";

export const BACKUP_APP_ID = "cybex-split-fitness";
export const BACKUP_SCHEMA_VERSION = 1;

// ---------- Schema ----------

const iso = z.string().min(1);
const muscle = z.enum(MUSCLE_GROUPS);
const nonNegative = z.number().finite().min(0);
const plateCount = z.object({ kg: z.number().positive(), count: z.number().int().min(0) });

const deviceImage = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("illustration") }),
  z.object({ kind: z.literal("upload"), blobId: z.string().min(1), fileName: z.string().optional() }),
  z.object({
    kind: z.literal("url"),
    url: z.string().min(1),
    source: z.string().min(1),
    license: z.string().optional(),
  }),
]);

const device = z.object({
  id: z.string().min(1),
  brand: z.literal("Cybex"),
  name: z.string().min(1),
  model: z.string().optional(),
  series: z.string().optional(),
  muscleGroup: muscle,
  description: z.string().optional(),
  loadingType: z.enum(["selectorized", "plate_loaded"]),
  weightIncrementKg: nonNegative.optional(),
  weightStepsNote: z.string().optional(),
  availablePlatesKg: z.array(z.number().positive()).optional(),
  startWeightKg: nonNegative.optional(),
  includeStartWeight: z.boolean().optional(),
  illustrationKey: z.string().optional(),
  image: deviceImage,
  isSeed: z.boolean(),
  archivedAt: iso.optional(),
  createdAt: iso,
  updatedAt: iso,
});

const exercise = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  muscleGroup: muscle,
  deviceId: z.string().min(1),
  variantLabel: z.string().optional(),
  description: z.string().optional(),
  illustrationKey: z.string().optional(),
  isSeed: z.boolean(),
  archivedAt: iso.optional(),
  createdAt: iso,
  updatedAt: iso,
});

const exerciseSetting = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  deviceId: z.string().min(1),
  seatHeight: z.string().optional(),
  startPosition: z.string().optional(),
  backrest: z.string().optional(),
  grip: z.string().optional(),
  notes: z.string().optional(),
  updatedAt: iso,
});

const template = z.object({
  id: z.string().min(1),
  split: z.enum(["A", "B"]),
  name: z.string().min(1),
  description: z.string(),
  allowedMuscleGroups: z.array(muscle),
  createdAt: iso,
  updatedAt: iso,
});

const slot = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  order: z.number().int().min(0),
  label: z.string().optional(),
  exerciseId: z.string().min(1),
  alternativeExerciseIds: z.array(z.string()),
  targetSets: z.number().int().min(1),
  targetRepsMin: z.number().int().min(0),
  targetRepsMax: z.number().int().min(0),
  restSeconds: z.number().int().min(0).optional(),
  active: z.boolean(),
  createdAt: iso,
  updatedAt: iso,
});

const session = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  split: z.enum(["A", "B"]),
  templateName: z.string(),
  status: z.enum(["in_progress", "paused", "completed", "aborted"]),
  startedAt: iso,
  endedAt: iso.optional(),
  pausedAt: iso.optional(),
  pausedDurationMs: z.number().min(0),
  notes: z.string(),
  restTimer: z.object({ endsAt: z.number(), durationSec: z.number() }).optional(),
  editedAt: iso.optional(),
  createdAt: iso,
  updatedAt: iso,
});

const snapshot = z.object({
  exerciseName: z.string(),
  variantLabel: z.string().optional(),
  deviceName: z.string(),
  deviceModel: z.string().optional(),
  muscleGroup: muscle,
  loadingType: z.enum(["selectorized", "plate_loaded"]),
  settingsText: z.string(),
  targetSets: z.number().int().min(0),
  targetRepsMin: z.number().int().min(0),
  targetRepsMax: z.number().int().min(0),
  restSeconds: z.number().int().min(0).optional(),
});

const sessionExercise = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  order: z.number(),
  slotId: z.string().optional(),
  exerciseId: z.string().min(1),
  deviceId: z.string().min(1),
  alternativeExerciseIds: z.array(z.string()),
  snapshot,
  status: z.enum(["active", "skipped"]),
  weightMode: z.enum(["block", "plates_total", "plates_calc"]),
  createdAt: iso,
  updatedAt: iso,
});

const weightBasis = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("block") }),
  z.object({
    mode: z.literal("plates_total"),
    platesKg: nonNegative.nullable(),
    includesStartWeight: z.boolean(),
    startWeightKg: nonNegative.optional(),
  }),
  z.object({
    mode: z.literal("plates_calc"),
    platesKg: nonNegative.nullable(),
    symmetric: z.boolean(),
    left: z.array(plateCount),
    right: z.array(plateCount),
    includesStartWeight: z.boolean(),
    startWeightKg: nonNegative.optional(),
  }),
]);

const setEntry = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sessionExerciseId: z.string().min(1),
  exerciseId: z.string().min(1),
  deviceId: z.string().min(1),
  index: z.number().int().min(0),
  weightKg: z.number().finite().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  completed: z.boolean(),
  isWarmup: z.boolean(),
  note: z.string().optional(),
  weightBasis,
  createdAt: iso,
  updatedAt: iso,
});

const settings = z.object({
  id: z.literal("user"),
  availablePlatesKg: z.array(z.number().positive()),
  restTimerEnabled: z.boolean(),
  defaultRestSeconds: z.number().int().min(0),
  includeWarmupInVolume: z.boolean(),
  lastBackupAt: iso.optional(),
  updatedAt: iso,
});

const image = z.object({
  id: z.string().min(1),
  mimeType: z.string().regex(/^image\//, "Nur Bilddateien erlaubt."),
  dataBase64: z.string(),
  createdAt: iso,
});

export const backupSchema = z
  .object({
    app: z.literal(BACKUP_APP_ID),
    schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
    exportedAt: iso,
    data: z.object({
      devices: z.array(device),
      exercises: z.array(exercise),
      exerciseSettings: z.array(exerciseSetting),
      templates: z.array(template),
      templateSlots: z.array(slot),
      sessions: z.array(session),
      sessionExercises: z.array(sessionExercise),
      sets: z.array(setEntry),
      settings: z.array(settings),
      images: z.array(image),
    }),
  })
  .superRefine((b, ctx) => {
    // Referenzielle Integrität prüfen.
    const ids = <T extends { id: string }>(arr: T[]) => new Set(arr.map((x) => x.id));
    const devices = ids(b.data.devices);
    const exercises = ids(b.data.exercises);
    const templates = ids(b.data.templates);
    const sessions = ids(b.data.sessions);
    const ses = ids(b.data.sessionExercises);
    const images = ids(b.data.images);
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    for (const e of b.data.exercises) if (!devices.has(e.deviceId)) issue(`Übung „${e.name}“ verweist auf unbekanntes Gerät.`);
    for (const s of b.data.templateSlots) {
      if (!templates.has(s.templateId)) issue("Übungsposition verweist auf unbekannte Vorlage.");
      if (!exercises.has(s.exerciseId)) issue("Übungsposition verweist auf unbekannte Übung.");
    }
    for (const se of b.data.sessionExercises) if (!sessions.has(se.sessionId)) issue("Trainingsübung ohne Trainingseinheit.");
    for (const s of b.data.sets) if (!ses.has(s.sessionExerciseId)) issue("Satz ohne zugehörige Trainingsübung.");
    for (const d of b.data.devices) {
      if (d.image.kind === "upload" && !images.has(d.image.blobId)) issue(`Bild für „${d.name}“ fehlt im Backup.`);
    }
  });

export type Backup = z.infer<typeof backupSchema>;

// ---------- Base64 ----------

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ---------- CSV ----------

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "ja" : "nein") : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function createBackupRepository(db: FitnessDB) {
  const repo = {
    async exportBackup(): Promise<Backup> {
      const [devices, exercises, exerciseSettings, templates, templateSlots, sessions, sessionExercises, sets, settings, images] =
        await Promise.all([
          db.devices.toArray(),
          db.exercises.toArray(),
          db.exerciseSettings.toArray(),
          db.templates.toArray(),
          db.templateSlots.toArray(),
          db.sessions.toArray(),
          db.sessionExercises.toArray(),
          db.sets.toArray(),
          db.settings.toArray(),
          db.deviceImages.toArray(),
        ]);
      return {
        app: BACKUP_APP_ID,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: nowIso(),
        data: {
          devices,
          exercises,
          exerciseSettings,
          templates,
          templateSlots,
          sessions,
          sessionExercises,
          sets,
          settings,
          images: images.map((i) => ({
            id: i.id,
            mimeType: i.mimeType,
            dataBase64: arrayBufferToBase64(i.data),
            createdAt: i.createdAt,
          })),
        },
      } as Backup;
    },

    async exportBackupJson(): Promise<string> {
      const json = JSON.stringify(await repo.exportBackup(), null, 2);
      await repo.markBackupDone();
      return json;
    },

    async markBackupDone() {
      const s = await db.settings.get("user");
      if (s) await db.settings.update("user", { lastBackupAt: nowIso() });
    },

    /** Prüft eine Backup-Datei. Gibt verständliche Fehlermeldungen zurück. */
    parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; errors: string[] } {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return { ok: false, errors: ["Die Datei ist kein gültiges JSON."] };
      }
      const result = backupSchema.safeParse(raw);
      if (!result.success) {
        return {
          ok: false,
          errors: result.error.issues.slice(0, 10).map((i) => {
            const path = i.path.join(".");
            return path ? `${path}: ${i.message}` : i.message;
          }),
        };
      }
      return { ok: true, backup: result.data };
    },

    /** Überschreibt ALLE lokalen Daten mit dem Backup (atomar). */
    async importBackup(backup: Backup) {
      const d = backup.data;
      await db.transaction("rw", db.allTables, async () => {
        await Promise.all(db.allTables.map((t) => t.clear()));
        await db.devices.bulkAdd(d.devices);
        await db.exercises.bulkAdd(d.exercises);
        await db.exerciseSettings.bulkAdd(d.exerciseSettings);
        await db.templates.bulkAdd(d.templates);
        await db.templateSlots.bulkAdd(d.templateSlots);
        await db.sessions.bulkAdd(d.sessions);
        await db.sessionExercises.bulkAdd(d.sessionExercises);
        await db.sets.bulkAdd(d.sets);
        await db.settings.bulkAdd(d.settings);
        await db.deviceImages.bulkAdd(
          d.images.map((i) => ({
            id: i.id,
            mimeType: i.mimeType,
            data: base64ToArrayBuffer(i.dataBase64),
            createdAt: i.createdAt,
          })),
        );
        await db.meta.put({ key: "seedVersion", value: "imported" });
      });
    },

    /** CSV (Semikolon, UTF-8 mit BOM) – eine Zeile pro Satz. */
    async exportCsv(): Promise<string> {
      const [sessions, ses, sets] = await Promise.all([
        db.sessions.toArray(),
        db.sessionExercises.toArray(),
        db.sets.toArray(),
      ]);
      const sessionById = new Map(sessions.map((s) => [s.id, s]));
      const seById = new Map(ses.map((s) => [s.id, s]));
      const header = [
        "Datum",
        "Startzeit",
        "Training",
        "Status",
        "Übung",
        "Variante",
        "Gerät",
        "Muskelgruppe",
        "Satz",
        "Aufwärmsatz",
        "Gewicht (kg)",
        "Wiederholungen",
        "Satz abgeschlossen",
        "Berechnungsgrundlage",
        "Satznotiz",
        "Trainingsnotiz",
        "Trainings-ID",
        "Übungs-ID",
        "Geräte-ID",
      ];
      const rows = sets
        .map((s) => ({ s, se: seById.get(s.sessionExerciseId), session: sessionById.get(s.sessionId) }))
        .filter((r) => r.se && r.session)
        .sort(
          (a, b) =>
            a.session!.startedAt.localeCompare(b.session!.startedAt) ||
            a.se!.order - b.se!.order ||
            a.s.index - b.s.index,
        )
        .map(({ s, se, session }) =>
          [
            formatDate(session!.startedAt),
            formatTime(session!.startedAt),
            `Training ${session!.split}`,
            SESSION_STATUS_LABELS[session!.status],
            se!.snapshot.exerciseName,
            se!.snapshot.variantLabel,
            se!.snapshot.deviceName,
            se!.snapshot.muscleGroup,
            s.index + 1,
            s.isWarmup,
            s.weightKg,
            s.reps,
            s.completed,
            describeBasis(s.weightBasis),
            s.note,
            session!.notes,
            session!.id,
            s.exerciseId,
            s.deviceId,
          ]
            .map(csvCell)
            .join(";"),
        );
      return "﻿" + [header.join(";"), ...rows].join("\r\n");
    },
  };
  return repo;
}

export type BackupRepository = ReturnType<typeof createBackupRepository>;
