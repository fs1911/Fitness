"use client";
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatKg, formatVolume } from "@/domain/format";
import type { SessionPoint } from "@/domain/metrics";

// Datenfarbe separat vom UI-Akzent: im Lightness-Band für dunkle Flächen validiert.
const SERIES = "#0d9488";
const GRID = "#2a303a";
const AXIS = "#a3acb9";

interface Row {
  label: string;
  date: string;
  top: number | null;
  reps: number | null;
  volume: number;
}

function toRows(points: SessionPoint[]): Row[] {
  return points.map((p) => ({
    label: formatDate(p.startedAt).slice(0, 5),
    date: formatDate(p.startedAt),
    top: p.topWeight,
    reps: p.repsAtTopWeight,
    volume: p.volume,
  }));
}

function ChartTooltip({
  active,
  payload,
  kind,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  kind: "weight" | "volume";
}) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm shadow-lg">
      <p className="text-muted">{r.date}</p>
      {kind === "weight" ? (
        <p className="tabular font-semibold">
          {formatKg(r.top)}
          {r.reps ? ` × ${r.reps}` : ""}
        </p>
      ) : (
        <p className="tabular font-semibold">{formatVolume(r.volume)}</p>
      )}
    </div>
  );
}

const axisProps = {
  stroke: GRID,
  tick: { fill: AXIS, fontSize: 12 },
  tickLine: false,
} as const;

export function WeightChart({ points }: { points: SessionPoint[] }) {
  const rows = toRows(points).filter((r) => r.top !== null);
  return (
    <figure aria-label="Diagramm: Entwicklung des höchsten Arbeitsgewichts pro Einheit">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} axisLine={false} width={60} domain={["auto", "auto"]} unit=" kg" />
          <Tooltip content={<ChartTooltip kind="weight" />} cursor={{ stroke: AXIS, strokeDasharray: "3 3" }} />
          <Line
            type="monotone"
            dataKey="top"
            stroke={SERIES}
            strokeWidth={2}
            dot={{ r: 4, fill: SERIES, stroke: "#14171c", strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function VolumeChart({ points }: { points: SessionPoint[] }) {
  const rows = toRows(points);
  return (
    <figure aria-label="Diagramm: Trainingsvolumen pro Einheit">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: -4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} axisLine={false} width={56} />
          <Tooltip content={<ChartTooltip kind="volume" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="volume" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
