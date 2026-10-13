export const MAX_WEIGHT_KG = 1000;
export const MAX_REPS = 1000;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Akzeptiert „12,5“, „12.5“, „ 80 “. Leere Eingabe ergibt `null`. */
export function parseWeight(input: string): ParseResult<number | null> {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (trimmed === "") return { ok: true, value: null };
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    if (normalized.startsWith("-")) {
      return { ok: false, error: "Gewicht darf nicht negativ sein." };
    }
    return { ok: false, error: "Bitte eine Zahl eingeben, z. B. 42,5." };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return { ok: false, error: "Ungültige Zahl." };
  if (value > MAX_WEIGHT_KG) {
    return { ok: false, error: `Maximal ${MAX_WEIGHT_KG} kg.` };
  }
  return { ok: true, value: Math.round(value * 1000) / 1000 };
}

/** Wiederholungen: nur ganze Zahlen ≥ 0. Leere Eingabe ergibt `null`. */
export function parseReps(input: string): ParseResult<number | null> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.startsWith("-")) {
    return { ok: false, error: "Wiederholungen dürfen nicht negativ sein." };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: "Nur ganze Wiederholungen eingeben." };
  }
  const value = Number(trimmed);
  if (value > MAX_REPS) return { ok: false, error: `Maximal ${MAX_REPS} Wiederholungen.` };
  return { ok: true, value };
}

export function isValidWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_WEIGHT_KG;
}

export function isValidReps(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_REPS;
}

/** Ein Satz darf nur mit gültigem Gewicht und mindestens 1 Wiederholung abgeschlossen werden. */
export function canCompleteSet(weightKg: number | null, reps: number | null): string | null {
  if (weightKg === null) return "Gewicht fehlt.";
  if (reps === null) return "Wiederholungen fehlen.";
  if (!isValidWeight(weightKg)) return "Ungültiges Gewicht.";
  if (!isValidReps(reps) || reps < 1) return "Mindestens 1 Wiederholung erforderlich.";
  return null;
}
