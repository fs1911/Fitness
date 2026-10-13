import type { SessionStatus, SetEntry } from "./types";
import { basisKey } from "./weightBasis";

/** Gültiger, abgeschlossener Satz mit Zahlenwerten. */
export function isCountableSet(
  set: Pick<SetEntry, "completed" | "weightKg" | "reps">,
): set is Pick<SetEntry, "completed"> & { weightKg: number; reps: number } {
  return set.completed && set.weightKg !== null && set.reps !== null && set.reps > 0;
}

/** Abgeschlossener Arbeitssatz (kein Aufwärmsatz). */
export function isWorkingSet(set: Pick<SetEntry, "completed" | "weightKg" | "reps" | "isWarmup">) {
  return isCountableSet(set) && !set.isWarmup;
}

/**
 * Trainingsvolumen = Σ Gewicht × Wiederholungen aller abgeschlossenen
 * Arbeitssätze. Aufwärmsätze werden standardmässig ausgeschlossen.
 */
export function computeVolume(
  sets: Pick<SetEntry, "completed" | "weightKg" | "reps" | "isWarmup">[],
  options: { includeWarmup?: boolean } = {},
): number {
  let sum = 0;
  for (const s of sets) {
    if (!isCountableSet(s)) continue;
    if (s.isWarmup && !options.includeWarmup) continue;
    sum += s.weightKg * s.reps;
  }
  return Math.round(sum * 100) / 100;
}

/** Höchstes Arbeitsgewicht (nur abgeschlossene Arbeitssätze). */
export function topWorkingWeight(sets: SetEntry[]): number | null {
  let max: number | null = null;
  for (const s of sets) {
    if (!isWorkingSet(s)) continue;
    if (max === null || s.weightKg! > max) max = s.weightKg!;
  }
  return max;
}

export interface SessionPoint {
  sessionId: string;
  startedAt: string;
  sets: SetEntry[];
  workingSets: SetEntry[];
  topWeight: number | null;
  /** Wiederholungen beim Top-Gewicht (bester Satz). */
  repsAtTopWeight: number | null;
  volume: number;
  totalReps: number;
}

export function buildSessionPoint(
  sessionId: string,
  startedAt: string,
  sets: SetEntry[],
  options: { includeWarmup?: boolean } = {},
): SessionPoint {
  const working = sets.filter(isWorkingSet).sort((a, b) => a.index - b.index);
  const top = topWorkingWeight(sets);
  const repsAtTop =
    top === null
      ? null
      : Math.max(...working.filter((s) => s.weightKg === top).map((s) => s.reps!));
  return {
    sessionId,
    startedAt,
    sets: [...sets].sort((a, b) => a.index - b.index),
    workingSets: working,
    topWeight: top,
    repsAtTopWeight: repsAtTop,
    volume: computeVolume(sets, options),
    totalReps: working.reduce((sum, s) => sum + s.reps!, 0),
  };
}

export interface SeriesKey {
  exerciseId: string;
  deviceId: string;
  basisKey: string;
}

export function seriesKeyString(k: SeriesKey): string {
  return `${k.exerciseId}|${k.deviceId}|${k.basisKey}`;
}

export interface SessionInfo {
  id: string;
  startedAt: string;
  status: SessionStatus;
}

export interface ProgressSeries {
  key: SeriesKey;
  points: SessionPoint[];
}

/**
 * Gruppiert Sätze einer Übung in vergleichbare Reihen
 * (gleiche Übung + gleiches Gerät + gleiche Berechnungsgrundlage).
 * Es fliessen nur Sätze aus abgeschlossenen Einheiten ein.
 */
export function buildProgressSeries(
  sets: SetEntry[],
  sessions: Map<string, SessionInfo>,
  options: { includeWarmup?: boolean } = {},
): ProgressSeries[] {
  const groups = new Map<string, { key: SeriesKey; bySession: Map<string, SetEntry[]> }>();
  for (const s of sets) {
    const session = sessions.get(s.sessionId);
    if (!session || session.status !== "completed") continue;
    const key: SeriesKey = {
      exerciseId: s.exerciseId,
      deviceId: s.deviceId,
      basisKey: basisKey(s.weightBasis),
    };
    const ks = seriesKeyString(key);
    let g = groups.get(ks);
    if (!g) {
      g = { key, bySession: new Map() };
      groups.set(ks, g);
    }
    const list = g.bySession.get(s.sessionId) ?? [];
    list.push(s);
    g.bySession.set(s.sessionId, list);
  }
  const result: ProgressSeries[] = [];
  for (const g of groups.values()) {
    const points = [...g.bySession.entries()]
      .map(([sid, list]) => buildSessionPoint(sid, sessions.get(sid)!.startedAt, list, options))
      .filter((p) => p.workingSets.length > 0 || p.sets.some((s) => isCountableSet(s)))
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    if (points.length > 0) result.push({ key: g.key, points });
  }
  return result.sort(
    (a, b) =>
      b.points[b.points.length - 1].startedAt.localeCompare(a.points[a.points.length - 1].startedAt),
  );
}

export interface PersonalRecords {
  maxWeight: { value: number; reps: number; sessionId: string; startedAt: string } | null;
  /** Höchste Wiederholungszahl je Gewicht. */
  maxRepsByWeight: { weightKg: number; reps: number; sessionId: string; startedAt: string }[];
  maxVolume: { value: number; sessionId: string; startedAt: string } | null;
}

/** Bestleistungen – ausschliesslich aus abgeschlossenen Arbeitssätzen. */
export function computeRecords(points: SessionPoint[]): PersonalRecords {
  let maxWeight: PersonalRecords["maxWeight"] = null;
  let maxVolume: PersonalRecords["maxVolume"] = null;
  const byWeight = new Map<number, { weightKg: number; reps: number; sessionId: string; startedAt: string }>();
  for (const p of points) {
    for (const s of p.workingSets) {
      const w = s.weightKg!;
      const r = s.reps!;
      if (!maxWeight || w > maxWeight.value || (w === maxWeight.value && r > maxWeight.reps)) {
        maxWeight = { value: w, reps: r, sessionId: p.sessionId, startedAt: p.startedAt };
      }
      const prev = byWeight.get(w);
      if (!prev || r > prev.reps) {
        byWeight.set(w, { weightKg: w, reps: r, sessionId: p.sessionId, startedAt: p.startedAt });
      }
    }
    if (p.volume > 0 && (!maxVolume || p.volume > maxVolume.value)) {
      maxVolume = { value: p.volume, sessionId: p.sessionId, startedAt: p.startedAt };
    }
  }
  return {
    maxWeight,
    maxRepsByWeight: [...byWeight.values()].sort((a, b) => b.weightKg - a.weightKg),
    maxVolume,
  };
}

export interface Comparison {
  topWeightDelta: number | null;
  volumeDelta: number;
  totalRepsDelta: number;
}

export function compareToPrevious(current: SessionPoint, previous: SessionPoint | undefined): Comparison | null {
  if (!previous) return null;
  return {
    topWeightDelta:
      current.topWeight !== null && previous.topWeight !== null
        ? Math.round((current.topWeight - previous.topWeight) * 100) / 100
        : null,
    volumeDelta: Math.round((current.volume - previous.volume) * 100) / 100,
    totalRepsDelta: current.totalReps - previous.totalReps,
  };
}

export type TimeRange =
  | { kind: "4w" }
  | { kind: "12w" }
  | { kind: "all" }
  | { kind: "custom"; from: string; to: string };

/** Filtert Punkte nach Zeitraum. `from`/`to` als yyyy-mm-dd (inklusive). */
export function filterByRange<T extends { startedAt: string }>(
  items: T[],
  range: TimeRange,
  now: Date = new Date(),
): T[] {
  if (range.kind === "all") return items;
  let from: Date;
  let to: Date = new Date(8640000000000000);
  if (range.kind === "4w" || range.kind === "12w") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (range.kind === "4w" ? 28 : 84));
  } else {
    from = range.from ? new Date(`${range.from}T00:00:00`) : new Date(0);
    to = range.to ? new Date(`${range.to}T23:59:59.999`) : to;
  }
  return items.filter((i) => {
    const t = new Date(i.startedAt);
    return t >= from && t <= to;
  });
}

/** Vorschlag für die nächste Einheit: der andere Split als zuletzt abgeschlossen. */
export function suggestNextSplit(lastCompletedSplit: "A" | "B" | undefined): "A" | "B" {
  if (lastCompletedSplit === "A") return "B";
  return "A";
}
