"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DeviceImage } from "@/components/DeviceImage";
import { VolumeChart, WeightChart } from "@/components/progress/ProgressCharts";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { repos } from "@/data";
import { formatDate, formatKg, formatVolume, toDateInputValue } from "@/domain/format";
import {
  compareToPrevious,
  computeRecords,
  filterByRange,
  seriesKeyString,
  type TimeRange,
} from "@/domain/metrics";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from "@/domain/types";
import { basisKeyLabel } from "@/domain/weightBasis";
import { useDeviceMap, useExerciseMap, useSettings } from "@/hooks/useData";
import { useQueryParam } from "@/hooks/useQueryParam";

export default function ProgressPage() {
  return (
    <React.Suspense fallback={<p className="py-10 text-center text-muted">Lädt …</p>}>
      <Progress />
    </React.Suspense>
  );
}

function HowCalculated({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-2 text-xs text-muted">
      <summary className="inline-flex min-h-8 cursor-pointer items-center gap-1">
        <Info className="size-3.5" aria-hidden /> Wie berechnet?
      </summary>
      <p className="mt-1">{children}</p>
    </details>
  );
}

function signed(v: number, fmt: (n: number) => string) {
  if (v === 0) return "± 0";
  return `${v > 0 ? "+" : "−"} ${fmt(Math.abs(v))}`;
}

function Progress() {
  const router = useRouter();
  const param = useQueryParam("uebung");
  const exercises = useExerciseMap();
  const devices = useDeviceMap();
  const settings = useSettings();
  const withHistory = useLiveQuery(() => repos.progress.exercisesWithHistory(), []);
  const [rangeKind, setRangeKind] = React.useState<TimeRange["kind"]>("12w");
  const [from, setFrom] = React.useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return toDateInputValue(d);
  });
  const [to, setTo] = React.useState(() => toDateInputValue(new Date()));
  const [seriesSel, setSeriesSel] = React.useState<string | null>(null);

  const exerciseId =
    param && exercises?.has(param) ? param : withHistory && withHistory.size > 0 ? [...withHistory][0] : null;
  const includeWarmup = settings?.includeWarmupInVolume ?? false;

  const series = useLiveQuery(
    () => (exerciseId ? repos.progress.seriesForExercise(exerciseId, { includeWarmup }) : Promise.resolve([])),
    [exerciseId, includeWarmup],
  );

  if (!exercises || !devices || !withHistory || !settings || series === undefined) {
    return <p className="py-10 text-center text-muted">Lädt …</p>;
  }

  if (withHistory.size === 0) {
    return (
      <div>
        <h1 className="mb-3 text-2xl font-semibold">Fortschritt</h1>
        <EmptyState title="Noch keine Daten">
          Sobald du ein Training mit abgeschlossenen Sätzen beendest, erscheint hier deine Entwicklung pro Übung und
          Gerät. Es werden keine Beispieldaten erzeugt.
        </EmptyState>
      </div>
    );
  }

  const exercise = exerciseId ? exercises.get(exerciseId) : undefined;
  const active = series.find((s) => seriesKeyString(s.key) === seriesSel) ?? series[0];
  const range: TimeRange = rangeKind === "custom" ? { kind: "custom", from, to } : ({ kind: rangeKind } as TimeRange);
  const allPoints = active?.points ?? [];
  const points = filterByRange(allPoints, range);
  const records = computeRecords(points);
  const lastPoint = points.at(-1);
  const prevPoint = lastPoint ? allPoints[allPoints.indexOf(lastPoint) - 1] : undefined;
  const cmp = lastPoint ? compareToPrevious(lastPoint, prevPoint) : null;
  const device = active ? devices.get(active.key.deviceId) : undefined;

  const allExercises = [...exercises.values()];

  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">Fortschritt</h1>

      <Field label="Übung" htmlFor="exercise-select">
        <Select
          id="exercise-select"
          value={exerciseId ?? ""}
          onChange={(e) => {
            setSeriesSel(null);
            router.replace(`/fortschritt/?uebung=${e.target.value}`);
          }}
        >
          {MUSCLE_GROUPS.map((mg) => {
            const items = allExercises.filter((e) => e.muscleGroup === mg);
            if (items.length === 0) return null;
            return (
              <optgroup key={mg} label={MUSCLE_GROUP_LABELS[mg]}>
                {items.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.variantLabel ? ` (${e.variantLabel})` : ""}
                    {withHistory.has(e.id) ? "" : " – keine Daten"}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </Select>
      </Field>

      {series.length > 1 && (
        <div className="mt-3">
          <Field label="Vergleichsreihe" htmlFor="series-select" hint="Verschiedene Geräte oder Berechnungsgrundlagen werden bewusst nicht miteinander verglichen.">
            <Select
              id="series-select"
              value={active ? seriesKeyString(active.key) : ""}
              onChange={(e) => setSeriesSel(e.target.value)}
            >
              {series.map((s) => (
                <option key={seriesKeyString(s.key)} value={seriesKeyString(s.key)}>
                  {devices.get(s.key.deviceId)?.name ?? "Unbekanntes Gerät"} · {basisKeyLabel(s.key.basisKey)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <div className="mt-3">
        <Segmented
          label="Zeitraum"
          value={rangeKind}
          onChange={setRangeKind}
          options={[
            { value: "4w", label: "4 Wo." },
            { value: "12w", label: "12 Wo." },
            { value: "all", label: "Gesamt" },
            { value: "custom", label: "Eigener" },
          ]}
        />
        {rangeKind === "custom" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Von" htmlFor="from">
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Bis" htmlFor="to">
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      {!active ? (
        <div className="mt-4">
          <EmptyState title="Keine abgeschlossenen Sätze">
            Für {exercise?.name ?? "diese Übung"} gibt es noch keine abgeschlossene Einheit.
          </EmptyState>
        </div>
      ) : (
        <>
          <Card className="mt-4 flex items-center gap-3 p-3">
            <DeviceImage device={device} size="thumb" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{exercise?.name}</p>
              <p className="truncate text-muted">{device?.name}</p>
              <p className="text-xs text-muted">{basisKeyLabel(active.key.basisKey)}</p>
            </div>
          </Card>

          {points.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Keine Daten im gewählten Zeitraum">Wähle einen längeren Zeitraum.</EmptyState>
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted">Höchstes Arbeitsgewicht</p>
                  <p className="tabular text-2xl font-semibold">{formatKg(records.maxWeight?.value)}</p>
                  {records.maxWeight && (
                    <p className="text-xs text-muted">
                      × {records.maxWeight.reps} Wdh. · {formatDate(records.maxWeight.startedAt)}
                    </p>
                  )}
                  <HowCalculated>
                    Grösstes Gewicht aller abgeschlossenen Arbeitssätze im Zeitraum. Aufwärmsätze, offene Sätze und
                    abgebrochene Einheiten zählen nicht.
                  </HowCalculated>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted">Höchstes Volumen / Einheit</p>
                  <p className="tabular text-2xl font-semibold">
                    {records.maxVolume ? formatVolume(records.maxVolume.value) : "–"}
                  </p>
                  {records.maxVolume && <p className="text-xs text-muted">{formatDate(records.maxVolume.startedAt)}</p>}
                  <HowCalculated>
                    Volumen = Σ Gewicht × Wiederholungen aller abgeschlossenen Arbeitssätze dieser Übung in einer Einheit
                    {includeWarmup ? " – inkl. Aufwärmsätze (Einstellung)" : " – Aufwärmsätze ausgeschlossen"}.
                  </HowCalculated>
                </Card>
              </div>

              {lastPoint && (
                <Card className="mt-3 p-3">
                  <p className="text-xs text-muted">
                    Letzte Durchführung ({formatDate(lastPoint.startedAt)}) vs. vorherige
                    {prevPoint ? ` (${formatDate(prevPoint.startedAt)})` : ""}
                  </p>
                  {cmp ? (
                    <dl className="tabular mt-1 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted">Top-Gewicht</dt>
                        <dd className="font-semibold">
                          {cmp.topWeightDelta === null ? "–" : signed(cmp.topWeightDelta, formatKg)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Volumen</dt>
                        <dd className="font-semibold">{signed(cmp.volumeDelta, formatVolume)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Wdh. gesamt</dt>
                        <dd className="font-semibold">{signed(cmp.totalRepsDelta, String)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-1 text-sm">Erste Durchführung in dieser Vergleichsreihe.</p>
                  )}
                  <HowCalculated>
                    Differenz zur unmittelbar vorherigen Einheit derselben Übung am selben Gerät mit derselben
                    Berechnungsgrundlage. Nur abgeschlossene Arbeitssätze.
                  </HowCalculated>
                </Card>
              )}

              <SectionTitle>Arbeitsgewicht</SectionTitle>
              <Card className="px-1 py-2">
                <WeightChart points={points} />
              </Card>
              <p className="mt-1 text-xs text-muted">Höchstes Arbeitsgewicht je Einheit (dokumentierte Gewichtskennzahl).</p>

              <SectionTitle>Trainingsvolumen</SectionTitle>
              <Card className="px-1 py-2">
                <VolumeChart points={points} />
              </Card>

              <SectionTitle>Höchste Wiederholungen je Gewicht</SectionTitle>
              <Card className="p-0">
                <table className="tabular w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="px-4 py-2 font-medium">Gewicht</th>
                      <th className="px-4 py-2 font-medium">Max. Wdh.</th>
                      <th className="px-4 py-2 font-medium">Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.maxRepsByWeight.map((r) => (
                      <tr key={r.weightKg} className="border-t border-border">
                        <td className="px-4 py-2">{formatKg(r.weightKg)}</td>
                        <td className="px-4 py-2">{r.reps}</td>
                        <td className="px-4 py-2">{formatDate(r.startedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <SectionTitle>Historie</SectionTitle>
              <ul className="space-y-2">
                {[...points].reverse().map((p) => (
                  <li key={p.sessionId}>
                    <Link href={`/verlauf/detail/?id=${p.sessionId}`}>
                      <Card className="p-3 hover:border-accent/60">
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="font-medium">{formatDate(p.startedAt)}</span>
                          <span className="tabular text-muted">
                            Top {formatKg(p.topWeight)} · Vol. {formatVolume(p.volume)}
                          </span>
                        </div>
                        <p className="tabular mt-1 text-sm">
                          {p.sets
                            .filter((s) => s.completed)
                            .map((s) => `${formatKg(s.weightKg)} × ${s.reps}${s.isWarmup ? " (Aufw.)" : ""}`)
                            .join(" · ")}
                        </p>
                        {p.sets.some((s) => !s.completed) && (
                          <p className="text-xs text-muted">
                            + {p.sets.filter((s) => !s.completed).length} offene Sätze (nicht gewertet)
                          </p>
                        )}
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
