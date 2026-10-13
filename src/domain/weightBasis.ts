import { describePlates, isUnbalanced } from "./plates";
import type { Device, WeightBasis, WeightMode } from "./types";
import { formatKg } from "./format";

/**
 * Schlüssel der Berechnungsgrundlage. Nur Sätze mit identischem Schlüssel
 * (und identischer Übung + Gerät) werden miteinander verglichen.
 */
export function basisKey(basis: WeightBasis): string {
  if (basis.mode === "block") return "block";
  if (basis.includesStartWeight && basis.startWeightKg !== undefined) {
    return `plates+start:${basis.startWeightKg}`;
  }
  return "plates";
}

export function basisKeyLabel(key: string): string {
  if (key === "block") return "Gewicht am Gewichtsblock";
  if (key === "plates") return "Aufgelegtes Scheibengewicht (ohne Start-/Schlittengewicht)";
  if (key.startsWith("plates+start:")) {
    const kg = Number(key.split(":")[1]);
    return `Scheibengewicht inkl. Startgewicht ${formatKg(kg)}`;
  }
  return key;
}

export function defaultWeightMode(device: Pick<Device, "loadingType">): WeightMode {
  return device.loadingType === "plate_loaded" ? "plates_total" : "block";
}

/** Erstellt eine leere Berechnungsgrundlage gemäss aktuellem Gerät und Modus. */
export function emptyBasis(
  mode: WeightMode,
  device: Pick<Device, "startWeightKg" | "includeStartWeight">,
): WeightBasis {
  const includesStartWeight = !!device.includeStartWeight && device.startWeightKg !== undefined;
  const start = includesStartWeight ? { startWeightKg: device.startWeightKg } : {};
  if (mode === "block") return { mode: "block" };
  if (mode === "plates_total") {
    return { mode: "plates_total", platesKg: null, includesStartWeight, ...start };
  }
  return {
    mode: "plates_calc",
    platesKg: null,
    symmetric: true,
    left: [],
    right: [],
    includesStartWeight,
    ...start,
  };
}

/** Kurzbeschreibung der Berechnungsgrundlage für Verlauf / Detailansichten. */
export function describeBasis(basis: WeightBasis): string {
  if (basis.mode === "block") return "Gewichtsblock";
  const start =
    basis.includesStartWeight && basis.startWeightKg !== undefined
      ? ` + Startgewicht ${formatKg(basis.startWeightKg)}`
      : "";
  if (basis.mode === "plates_total") {
    return `Scheibengewicht gesamt ${formatKg(basis.platesKg)}${start}`;
  }
  const load = { left: basis.left, right: basis.right, symmetric: basis.symmetric };
  const sides = basis.symmetric
    ? `je Seite ${describePlates(basis.left)}`
    : `links ${describePlates(basis.left)}, rechts ${describePlates(basis.right)}`;
  const warn = isUnbalanced(load) ? " – ungleiche Beladung" : "";
  return `Scheibenrechner: ${sides}${start}${warn}`;
}
