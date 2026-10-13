import type { PlateCount } from "./types";

export const DEFAULT_PLATES_KG = [1.25, 2.5, 5, 10, 15, 20, 25];

const round = (n: number) => Math.round(n * 1000) / 1000;

export function sideWeight(plates: PlateCount[]): number {
  return round(
    plates.reduce((sum, p) => sum + (p.count > 0 && p.kg > 0 ? p.kg * p.count : 0), 0),
  );
}

export interface PlateLoad {
  left: PlateCount[];
  right: PlateCount[];
  symmetric: boolean;
}

/**
 * Gesamtes aufgelegtes Scheibengewicht.
 * Symmetrisch: Eingabe einer Seite, automatische Verdopplung.
 */
export function totalPlateWeight(load: PlateLoad): number {
  if (load.symmetric) return round(sideWeight(load.left) * 2);
  return round(sideWeight(load.left) + sideWeight(load.right));
}

export function isUnbalanced(load: PlateLoad): boolean {
  if (load.symmetric) return false;
  return sideWeight(load.left) !== sideWeight(load.right);
}

/** Entfernt leere Einträge und fasst gleiche Scheibengrössen zusammen. */
export function normalizePlates(plates: PlateCount[]): PlateCount[] {
  const map = new Map<number, number>();
  for (const p of plates) {
    if (p.kg > 0 && p.count > 0) map.set(p.kg, (map.get(p.kg) ?? 0) + Math.floor(p.count));
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([kg, count]) => ({ kg, count }));
}

/** Dokumentierte Gewichtskennzahl: Scheiben + (optional) verifiziertes Startgewicht. */
export function documentedWeight(
  platesKg: number,
  startWeightKg: number | undefined,
  includeStartWeight: boolean,
): number {
  if (includeStartWeight && startWeightKg !== undefined && startWeightKg > 0) {
    return round(platesKg + startWeightKg);
  }
  return round(platesKg);
}

export function describePlates(plates: PlateCount[]): string {
  const n = normalizePlates(plates);
  if (n.length === 0) return "keine Scheiben";
  return n.map((p) => `${p.count} × ${String(p.kg).replace(".", ",")} kg`).join(" + ");
}
