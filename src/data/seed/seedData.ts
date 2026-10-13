import type { LoadingType, MuscleGroup } from "@/domain/types";

/**
 * Vorbereitete Gerätekategorien. Bewusst OHNE Modell- oder Seriennummern:
 * Die konkrete Cybex-Ausführung im Studio ist nicht verifiziert.
 */
export interface SeedDevice {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  loadingType: LoadingType;
  illustrationKey: string;
  description: string;
  weightIncrementKg?: number;
}

export interface SeedExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  deviceId: string;
  description?: string;
}

export const SEED_DEVICES: SeedDevice[] = [
  {
    id: "dev-chest-press",
    name: "Cybex Brustpresse",
    muscleGroup: "brust",
    loadingType: "selectorized",
    illustrationKey: "chest-press",
    description: "Brustpresse mit Gewichtsblock. Gewicht wird per Steckstift gewählt.",
  },
  {
    id: "dev-pec-fly",
    name: "Cybex Butterfly / Pec Fly",
    muscleGroup: "brust",
    loadingType: "selectorized",
    illustrationKey: "pec-fly",
    description:
      "Butterfly-Gerät mit Gewichtsblock. Falls es im Studio eine Kombimaschine für Butterfly und Reverse Butterfly ist, kann die Übung „Reverse Butterfly“ diesem Gerät zugeordnet werden.",
  },
  {
    id: "dev-lat-pulldown",
    name: "Cybex Latzug",
    muscleGroup: "ruecken",
    loadingType: "selectorized",
    illustrationKey: "lat-pulldown",
    description: "Latzug mit Gewichtsblock.",
  },
  {
    id: "dev-row",
    name: "Cybex Rudermaschine",
    muscleGroup: "ruecken",
    loadingType: "selectorized",
    illustrationKey: "row",
    description: "Sitzende Rudermaschine mit Gewichtsblock.",
  },
  {
    id: "dev-rear-delt",
    name: "Cybex Reverse Butterfly / Rear Delt",
    muscleGroup: "ruecken",
    loadingType: "selectorized",
    illustrationKey: "rear-delt",
    description:
      "Separates Gerät für Reverse Butterfly. Wird im Studio eine Kombimaschine genutzt, kann die Übung stattdessen dem Butterfly-Gerät zugeordnet werden.",
  },
  {
    id: "dev-biceps",
    name: "Cybex Bizepsmaschine",
    muscleGroup: "bizeps",
    loadingType: "selectorized",
    illustrationKey: "biceps",
    description: "Bizepscurl-Maschine mit Gewichtsblock.",
  },
  {
    id: "dev-triceps",
    name: "Cybex Trizepsmaschine",
    muscleGroup: "trizeps",
    loadingType: "selectorized",
    illustrationKey: "triceps",
    description: "Trizepsstreck-Maschine mit Gewichtsblock.",
  },
  {
    id: "dev-abdominal",
    name: "Cybex Bauchmaschine",
    muscleGroup: "bauch",
    loadingType: "selectorized",
    illustrationKey: "abdominal",
    description: "Bauchcrunch-Maschine mit Gewichtsblock. Wird in Training A und B genutzt.",
  },
  {
    id: "dev-leg-press-stack",
    name: "Cybex Beinpresse – Gewichtsblock",
    muscleGroup: "beine",
    loadingType: "selectorized",
    illustrationKey: "leg-press-stack",
    description: "Beinpresse, Gewicht per Steckstift am Gewichtsblock gewählt.",
  },
  {
    id: "dev-leg-press-plates",
    name: "Cybex Beinpresse – Gewichtsscheiben",
    muscleGroup: "beine",
    loadingType: "plate_loaded",
    illustrationKey: "leg-press-plates",
    description:
      "Scheibenbeladene Beinpresse (Plate-loaded). Dokumentiert wird standardmässig nur das aufgelegte Scheibengewicht – kein Schlitten- oder Startgewicht.",
  },
  {
    id: "dev-leg-extension",
    name: "Cybex Beinstrecker",
    muscleGroup: "beine",
    loadingType: "selectorized",
    illustrationKey: "leg-extension",
    description: "Beinstrecker mit Gewichtsblock.",
  },
  {
    id: "dev-leg-curl",
    name: "Cybex Beinbeuger",
    muscleGroup: "beine",
    loadingType: "selectorized",
    illustrationKey: "leg-curl",
    description:
      "Beinbeuger mit Gewichtsblock. Ausführung (z. B. sitzend oder liegend) bei der Übung als Variante hinterlegbar.",
  },
  {
    id: "dev-calf",
    name: "Cybex Wadenmaschine",
    muscleGroup: "beine",
    loadingType: "selectorized",
    illustrationKey: "calf",
    description: "Wadenmaschine. Gewichtserfassung und Gerätevariante sind editierbar.",
  },
];

export const SEED_EXERCISES: SeedExercise[] = [
  { id: "ex-chest-press", name: "Brustpressen", muscleGroup: "brust", deviceId: "dev-chest-press" },
  { id: "ex-butterfly", name: "Butterfly", muscleGroup: "brust", deviceId: "dev-pec-fly" },
  { id: "ex-lat-pulldown", name: "Latzug", muscleGroup: "ruecken", deviceId: "dev-lat-pulldown" },
  { id: "ex-row", name: "Rudern", muscleGroup: "ruecken", deviceId: "dev-row" },
  {
    id: "ex-reverse-butterfly",
    name: "Reverse Butterfly",
    muscleGroup: "ruecken",
    deviceId: "dev-rear-delt",
  },
  { id: "ex-biceps-curl", name: "Bizepscurls", muscleGroup: "bizeps", deviceId: "dev-biceps" },
  {
    id: "ex-triceps-extension",
    name: "Trizepsstrecken",
    muscleGroup: "trizeps",
    deviceId: "dev-triceps",
  },
  { id: "ex-crunch", name: "Bauchcrunch", muscleGroup: "bauch", deviceId: "dev-abdominal" },
  {
    id: "ex-leg-press-stack",
    name: "Beinpresse – Gewichtsblock",
    muscleGroup: "beine",
    deviceId: "dev-leg-press-stack",
  },
  {
    id: "ex-leg-press-plates",
    name: "Beinpresse – Gewichtsscheiben",
    muscleGroup: "beine",
    deviceId: "dev-leg-press-plates",
  },
  { id: "ex-leg-extension", name: "Beinstrecken", muscleGroup: "beine", deviceId: "dev-leg-extension" },
  {
    id: "ex-leg-curl",
    name: "Beinbeugen",
    muscleGroup: "beine",
    deviceId: "dev-leg-curl",
    description: "Ausführung (sitzend / liegend) als Variante ergänzbar.",
  },
  { id: "ex-calf-raise", name: "Wadenheben", muscleGroup: "beine", deviceId: "dev-calf" },
];

export interface SeedSlot {
  id: string;
  exerciseId: string;
  label?: string;
  alternativeExerciseIds?: string[];
}

export const SEED_TEMPLATE_A_SLOTS: SeedSlot[] = [
  { id: "slot-a-1", exerciseId: "ex-chest-press" },
  { id: "slot-a-2", exerciseId: "ex-butterfly" },
  { id: "slot-a-3", exerciseId: "ex-lat-pulldown" },
  { id: "slot-a-4", exerciseId: "ex-row" },
  { id: "slot-a-5", exerciseId: "ex-reverse-butterfly" },
  { id: "slot-a-6", exerciseId: "ex-biceps-curl" },
  { id: "slot-a-7", exerciseId: "ex-triceps-extension" },
  { id: "slot-a-8", exerciseId: "ex-crunch" },
];

export const SEED_TEMPLATE_B_SLOTS: SeedSlot[] = [
  {
    id: "slot-b-1",
    exerciseId: "ex-leg-press-stack",
    label: "Beinpresse",
    alternativeExerciseIds: ["ex-leg-press-plates"],
  },
  { id: "slot-b-2", exerciseId: "ex-leg-extension" },
  { id: "slot-b-3", exerciseId: "ex-leg-curl" },
  { id: "slot-b-4", exerciseId: "ex-calf-raise" },
  { id: "slot-b-5", exerciseId: "ex-crunch" },
];

export const SEED_DEFAULT_TARGET = { sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90 };
