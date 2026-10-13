import { describe, expect, it } from "vitest";
import { parseReps, parseWeight, canCompleteSet } from "@/domain/parse";
import { isUnbalanced, totalPlateWeight, documentedWeight } from "@/domain/plates";
import {
  buildProgressSeries,
  computeRecords,
  computeVolume,
  compareToPrevious,
  filterByRange,
  suggestNextSplit,
} from "@/domain/metrics";
import { formatDate, formatTime, formatDuration, startOfWeek } from "@/domain/format";
import { basisKey } from "@/domain/weightBasis";
import type { SetEntry } from "@/domain/types";

function set(p: Partial<SetEntry>): SetEntry {
  return {
    id: Math.random().toString(),
    sessionId: "s1",
    sessionExerciseId: "se1",
    exerciseId: "ex",
    deviceId: "dev",
    index: 0,
    weightKg: 50,
    reps: 10,
    completed: true,
    isWarmup: false,
    weightBasis: { mode: "block" },
    createdAt: "",
    updatedAt: "",
    ...p,
  };
}

describe("Eingabe-Validierung", () => {
  it("akzeptiert Komma als Dezimaltrennzeichen", () => {
    expect(parseWeight("42,5")).toEqual({ ok: true, value: 42.5 });
    expect(parseWeight("42.5")).toEqual({ ok: true, value: 42.5 });
    expect(parseWeight("")).toEqual({ ok: true, value: null });
  });
  it("lehnt negative Gewichte und Text ab", () => {
    expect(parseWeight("-5").ok).toBe(false);
    expect(parseWeight("abc").ok).toBe(false);
  });
  it("Wiederholungen nur ganzzahlig und nicht negativ", () => {
    expect(parseReps("10")).toEqual({ ok: true, value: 10 });
    expect(parseReps("10,5").ok).toBe(false);
    expect(parseReps("-1").ok).toBe(false);
  });
  it("Satz abschliessen erfordert Gewicht und ≥1 Wiederholung", () => {
    expect(canCompleteSet(null, 10)).not.toBeNull();
    expect(canCompleteSet(20, 0)).not.toBeNull();
    expect(canCompleteSet(20, 8)).toBeNull();
  });
});

describe("Scheibenrechner", () => {
  it("zwei Scheiben à 20 kg je Seite ergeben 80 kg (symmetrisch)", () => {
    expect(totalPlateWeight({ symmetric: true, left: [{ kg: 20, count: 2 }], right: [] })).toBe(80);
  });
  it("kombiniert mehrere Scheibengrössen", () => {
    const load = { symmetric: true, left: [{ kg: 20, count: 1 }, { kg: 10, count: 1 }, { kg: 2.5, count: 1 }], right: [] };
    expect(totalPlateWeight(load)).toBe(65);
  });
  it("erkennt ungleiche Beladung links/rechts", () => {
    const load = { symmetric: false, left: [{ kg: 20, count: 2 }], right: [{ kg: 20, count: 1 }] };
    expect(totalPlateWeight(load)).toBe(60);
    expect(isUnbalanced(load)).toBe(true);
    expect(isUnbalanced({ symmetric: false, left: [{ kg: 10, count: 2 }], right: [{ kg: 20, count: 1 }] })).toBe(false);
  });
  it("Startgewicht fliesst nur ein, wenn explizit aktiviert", () => {
    expect(documentedWeight(80, 30, false)).toBe(80);
    expect(documentedWeight(80, 30, true)).toBe(110);
    expect(documentedWeight(80, undefined, true)).toBe(80);
  });
  it("Berechnungsgrundlagen mit/ohne Startgewicht sind unterschiedliche Schlüssel", () => {
    expect(basisKey({ mode: "block" })).toBe("block");
    expect(basisKey({ mode: "plates_total", platesKg: 80, includesStartWeight: false })).toBe("plates");
    expect(
      basisKey({ mode: "plates_calc", platesKg: 80, symmetric: true, left: [], right: [], includesStartWeight: false }),
    ).toBe("plates");
    expect(basisKey({ mode: "plates_total", platesKg: 80, includesStartWeight: true, startWeightKg: 30 })).toBe(
      "plates+start:30",
    );
  });
});

describe("Volumen", () => {
  it("summiert Gewicht × Wiederholungen abgeschlossener Arbeitssätze", () => {
    const sets = [set({ weightKg: 50, reps: 10 }), set({ weightKg: 60, reps: 8 })];
    expect(computeVolume(sets)).toBe(980);
  });
  it("schliesst Aufwärmsätze standardmässig aus", () => {
    const sets = [set({ weightKg: 20, reps: 15, isWarmup: true }), set({ weightKg: 50, reps: 10 })];
    expect(computeVolume(sets)).toBe(500);
    expect(computeVolume(sets, { includeWarmup: true })).toBe(800);
  });
  it("ignoriert offene oder unvollständige Sätze", () => {
    const sets = [set({ completed: false }), set({ reps: null }), set({ weightKg: 40, reps: 10 })];
    expect(computeVolume(sets)).toBe(400);
  });
});

describe("Fortschritt & Bestleistungen", () => {
  const sessions = new Map([
    ["s1", { id: "s1", startedAt: "2026-01-01T10:00:00.000Z", status: "completed" as const }],
    ["s2", { id: "s2", startedAt: "2026-01-05T10:00:00.000Z", status: "completed" as const }],
    ["s3", { id: "s3", startedAt: "2026-01-08T10:00:00.000Z", status: "aborted" as const }],
  ]);

  it("abgebrochene Einheiten und offene Sätze fliessen nicht in Bestleistungen ein", () => {
    const sets = [
      set({ sessionId: "s1", weightKg: 50, reps: 10 }),
      set({ sessionId: "s2", weightKg: 55, reps: 8 }),
      set({ sessionId: "s2", weightKg: 80, reps: 5, completed: false }),
      set({ sessionId: "s2", weightKg: 70, reps: 5, isWarmup: true }),
      set({ sessionId: "s3", weightKg: 100, reps: 10 }),
    ];
    const [series] = buildProgressSeries(sets, sessions);
    const rec = computeRecords(series.points);
    expect(rec.maxWeight?.value).toBe(55);
    expect(series.points).toHaveLength(2);
  });

  it("trennt Reihen nach Gerät und Berechnungsgrundlage", () => {
    const sets = [
      set({ sessionId: "s1", deviceId: "a" }),
      set({ sessionId: "s2", deviceId: "b" }),
      set({ sessionId: "s2", deviceId: "b", weightBasis: { mode: "plates_total", platesKg: 50, includesStartWeight: false } }),
    ];
    expect(buildProgressSeries(sets, sessions)).toHaveLength(3);
  });

  it("höchste Wiederholungszahl je Gewicht", () => {
    const sets = [
      set({ sessionId: "s1", weightKg: 50, reps: 10 }),
      set({ sessionId: "s2", weightKg: 50, reps: 12 }),
      set({ sessionId: "s2", weightKg: 55, reps: 6 }),
    ];
    const [series] = buildProgressSeries(sets, sessions);
    const rec = computeRecords(series.points);
    expect(rec.maxRepsByWeight).toEqual([
      expect.objectContaining({ weightKg: 55, reps: 6 }),
      expect.objectContaining({ weightKg: 50, reps: 12 }),
    ]);
  });

  it("vergleicht mit der vorherigen Durchführung", () => {
    const sets = [set({ sessionId: "s1", weightKg: 50, reps: 10 }), set({ sessionId: "s2", weightKg: 55, reps: 10 })];
    const [series] = buildProgressSeries(sets, sessions);
    expect(compareToPrevious(series.points[1], series.points[0])).toEqual({
      topWeightDelta: 5,
      volumeDelta: 50,
      totalRepsDelta: 0,
    });
  });

  it("Zeitfilter", () => {
    const now = new Date("2026-02-01T12:00:00");
    const items = [{ startedAt: "2025-12-01T10:00:00" }, { startedAt: "2026-01-20T10:00:00" }];
    expect(filterByRange(items, { kind: "4w" }, now)).toHaveLength(1);
    expect(filterByRange(items, { kind: "12w" }, now)).toHaveLength(2);
    expect(filterByRange(items, { kind: "custom", from: "2025-11-01", to: "2025-12-31" }, now)).toHaveLength(1);
  });

  it("Vorschlag der nächsten Einheit", () => {
    expect(suggestNextSplit("A")).toBe("B");
    expect(suggestNextSplit("B")).toBe("A");
    expect(suggestNextSplit(undefined)).toBe("A");
  });
});

describe("Formatierung", () => {
  it("Datum TT.MM.JJJJ und Zeit 24 h", () => {
    const d = new Date(2026, 2, 7, 18, 5);
    expect(formatDate(d)).toBe("07.03.2026");
    expect(formatTime(d)).toBe("18:05");
  });
  it("Dauer", () => {
    expect(formatDuration(65 * 60000)).toBe("1 h 05 min");
    expect(formatDuration(42 * 60000)).toBe("42 min");
  });
  it("Wochenbeginn Montag", () => {
    expect(startOfWeek(new Date(2026, 9, 18, 12)).getDay()).toBe(1);
  });
});
