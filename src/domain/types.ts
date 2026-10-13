/**
 * Domänentypen der App.
 *
 * Begriffe:
 * - Device: physisches Gerät im Studio (z. B. eine Kombimaschine).
 * - Exercise: Übung. Eine Übung ist genau einem Gerät zugeordnet; mehrere
 *   Übungen können dasselbe Gerät nutzen (Butterfly / Reverse Butterfly).
 * - TemplateSlot: Übungsposition innerhalb einer Trainingsvorlage, inkl.
 *   alternativer Übungen (z. B. Beinpresse Block ↔ Scheiben).
 * - SessionExercise: tatsächlich durchgeführte Übung in einer Einheit,
 *   mit Snapshot der Vorlagen- und Gerätedaten zum Zeitpunkt des Starts.
 * - SetEntry: einzelner Satz inkl. gespeicherter Berechnungsgrundlage.
 */

export type ISODateString = string;

export const MUSCLE_GROUPS = [
  "brust",
  "ruecken",
  "schultern",
  "bizeps",
  "trizeps",
  "bauch",
  "beine",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  brust: "Brust",
  ruecken: "Rücken",
  schultern: "Schultern",
  bizeps: "Bizeps",
  trizeps: "Trizeps",
  bauch: "Bauch",
  beine: "Beine",
};

export type Split = "A" | "B";

/** Verbindliche Muskelgruppen-Zuordnung des Zweier-Splits. */
export const SPLIT_MUSCLE_GROUPS: Record<Split, MuscleGroup[]> = {
  A: ["brust", "ruecken", "schultern", "bizeps", "trizeps", "bauch"],
  B: ["beine", "bauch"],
};

/** Beladungsart / Gerätevariante. */
export type LoadingType = "selectorized" | "plate_loaded";

export const LOADING_TYPE_LABELS: Record<LoadingType, string> = {
  selectorized: "Gewichtsblock (Steckstift)",
  plate_loaded: "Gewichtsscheiben (Plate-loaded)",
};

export type DeviceImage =
  | { kind: "illustration" }
  | { kind: "upload"; blobId: string; fileName?: string }
  | { kind: "url"; url: string; source: string; license?: string };

export interface Device {
  id: string;
  brand: "Cybex";
  name: string;
  /** Konkrete Modellbezeichnung – nur wenn verifiziert eingetragen. */
  model?: string;
  series?: string;
  muscleGroup: MuscleGroup;
  description?: string;
  loadingType: LoadingType;
  /** Gewichtsabstufung am Gewichtsblock, z. B. 5 kg. */
  weightIncrementKg?: number;
  /** Freitext zur Gewichtsabstufung, z. B. „5 kg-Schritte, Zusatzgewicht 2,5 kg“. */
  weightStepsNote?: string;
  /** Geräte-spezifische Scheibengrössen (überschreibt Benutzereinstellung). */
  availablePlatesKg?: number[];
  /** Verifiziertes Start-/Schlittengewicht (nur Plate-loaded, nur wenn bekannt). */
  startWeightKg?: number;
  /** Fliesst das Startgewicht in die dokumentierte Gewichtskennzahl ein? */
  includeStartWeight?: boolean;
  /** Schlüssel der mitgelieferten Illustration. */
  illustrationKey?: string;
  image: DeviceImage;
  isSeed: boolean;
  archivedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface DeviceImageBlob {
  id: string;
  mimeType: string;
  /** ArrayBuffer statt Blob: robuster über Browser hinweg und im Backup. */
  data: ArrayBuffer;
  createdAt: ISODateString;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  deviceId: string;
  /** Ausführungsvariante, z. B. „sitzend“ oder „liegend“. */
  variantLabel?: string;
  description?: string;
  isSeed: boolean;
  archivedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Persönliche Einstellungen pro Übung UND Gerät. */
export interface ExerciseSetting {
  /** `${exerciseId}__${deviceId}` */
  id: string;
  exerciseId: string;
  deviceId: string;
  seatHeight?: string;
  startPosition?: string;
  backrest?: string;
  grip?: string;
  notes?: string;
  updatedAt: ISODateString;
}

export interface WorkoutTemplate {
  id: string;
  split: Split;
  name: string;
  description: string;
  allowedMuscleGroups: MuscleGroup[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface TemplateSlot {
  id: string;
  templateId: string;
  order: number;
  /** Optionale Bezeichnung der Position, z. B. „Beinpresse“. */
  label?: string;
  exerciseId: string;
  /** Bereits zugeordnete Alternativen (z. B. andere Gerätevariante). */
  alternativeExerciseIds: string[];
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSeconds?: number;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type SessionStatus = "in_progress" | "paused" | "completed" | "aborted";

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  in_progress: "Läuft",
  paused: "Pausiert",
  completed: "Abgeschlossen",
  aborted: "Abgebrochen",
};

export interface RestTimerState {
  endsAt: number;
  durationSec: number;
}

export interface WorkoutSession {
  id: string;
  templateId: string;
  split: Split;
  templateName: string;
  status: SessionStatus;
  startedAt: ISODateString;
  endedAt?: ISODateString;
  pausedAt?: ISODateString;
  pausedDurationMs: number;
  notes: string;
  restTimer?: RestTimerState;
  /** Gesetzt, wenn eine abgeschlossene Einheit nachträglich korrigiert wurde. */
  editedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Eingabemodus für Gewichte. */
export type WeightMode = "block" | "plates_total" | "plates_calc";

export interface ExerciseSnapshot {
  exerciseName: string;
  variantLabel?: string;
  deviceName: string;
  deviceModel?: string;
  muscleGroup: MuscleGroup;
  loadingType: LoadingType;
  settingsText: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSeconds?: number;
}

export type SessionExerciseStatus = "active" | "skipped";

export interface SessionExercise {
  id: string;
  sessionId: string;
  order: number;
  slotId?: string;
  exerciseId: string;
  /** Tatsächlich verwendetes Gerät. */
  deviceId: string;
  alternativeExerciseIds: string[];
  snapshot: ExerciseSnapshot;
  status: SessionExerciseStatus;
  weightMode: WeightMode;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PlateCount {
  kg: number;
  count: number;
}

/**
 * Berechnungsgrundlage eines Satzes. Wird pro Satz gespeichert, damit
 * spätere Änderungen an Geräteeinstellungen historische Werte nicht neu
 * interpretieren.
 */
export type WeightBasis =
  | { mode: "block" }
  | {
      mode: "plates_total";
      platesKg: number | null;
      includesStartWeight: boolean;
      startWeightKg?: number;
    }
  | {
      mode: "plates_calc";
      platesKg: number | null;
      symmetric: boolean;
      left: PlateCount[];
      right: PlateCount[];
      includesStartWeight: boolean;
      startWeightKg?: number;
    };

export interface SetEntry {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  /** Denormalisiert für schnelle Historien-Abfragen. */
  exerciseId: string;
  deviceId: string;
  index: number;
  /** Dokumentierte Gewichtskennzahl in kg. */
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  isWarmup: boolean;
  note?: string;
  weightBasis: WeightBasis;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface UserSettings {
  id: "user";
  availablePlatesKg: number[];
  restTimerEnabled: boolean;
  defaultRestSeconds: number;
  includeWarmupInVolume: boolean;
  lastBackupAt?: ISODateString;
  updatedAt: ISODateString;
}

export interface MetaEntry {
  key: string;
  value: string;
}
