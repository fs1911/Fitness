"use client";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/input";
import { formatKg } from "@/domain/format";
import { documentedWeight, isUnbalanced, normalizePlates, sideWeight, totalPlateWeight } from "@/domain/plates";
import type { PlateCount } from "@/domain/types";

export interface PlateCalcResult {
  left: PlateCount[];
  right: PlateCount[];
  symmetric: boolean;
  platesKg: number;
}

function toCounts(plates: PlateCount[], sizes: number[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const s of sizes) out[s] = 0;
  for (const p of plates) out[p.kg] = (out[p.kg] ?? 0) + p.count;
  return out;
}

const fromCounts = (c: Record<number, number>) =>
  normalizePlates(Object.entries(c).map(([kg, count]) => ({ kg: Number(kg), count })));

function SideEditor({
  title,
  sizes,
  counts,
  onChange,
}: {
  title: string;
  sizes: number[];
  counts: Record<number, number>;
  onChange: (c: Record<number, number>) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-medium text-muted">
        {title} – {formatKg(sideWeight(fromCounts(counts)))}
      </legend>
      <ul className="space-y-1">
        {sizes.map((kg) => (
          <li key={kg} className="flex items-center justify-between gap-2">
            <span className="tabular w-20 font-medium">{formatKg(kg)}</span>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={`${formatKg(kg)} entfernen (${title})`}
                disabled={!counts[kg]}
                onClick={() => onChange({ ...counts, [kg]: Math.max(0, (counts[kg] ?? 0) - 1) })}
              >
                <Minus />
              </Button>
              <span className="tabular w-8 text-center text-lg" aria-live="polite">
                {counts[kg] ?? 0}
              </span>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={`${formatKg(kg)} hinzufügen (${title})`}
                onClick={() => onChange({ ...counts, [kg]: (counts[kg] ?? 0) + 1 })}
              >
                <Plus />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

export function PlateCalculatorDialog({
  open,
  onOpenChange,
  sizes,
  initial,
  startWeightKg,
  includeStartWeight,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sizes: number[];
  initial?: { left: PlateCount[]; right: PlateCount[]; symmetric: boolean };
  startWeightKg?: number;
  includeStartWeight: boolean;
  onApply: (r: PlateCalcResult) => void;
}) {
  const sorted = React.useMemo(() => [...sizes].sort((a, b) => b - a), [sizes]);
  const [symmetric, setSymmetric] = React.useState(initial?.symmetric ?? true);
  const [left, setLeft] = React.useState(() => toCounts(initial?.left ?? [], sorted));
  const [right, setRight] = React.useState(() => toCounts(initial?.right ?? [], sorted));


  const load = { left: fromCounts(left), right: symmetric ? [] : fromCounts(right), symmetric };
  const total = totalPlateWeight(load);
  const unbalanced = isUnbalanced(load);
  const documented = documentedWeight(total, startWeightKg, includeStartWeight);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Scheibenrechner"
      description="Erfasst wird das aufgelegte Scheibengewicht. Es ist keine Angabe über die effektive Kraft oder den mechanischen Widerstand."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onApply({ ...load, right: symmetric ? load.left : load.right, platesKg: total });
              onOpenChange(false);
            }}
          >
            Übernehmen ({formatKg(documented)})
          </Button>
        </>
      }
    >
      <Checkbox
        label="Symmetrische Beladung (eine Seite eingeben, wird verdoppelt)"
        checked={symmetric}
        onChange={(e) => {
          setSymmetric(e.target.checked);
          if (!e.target.checked) setRight({ ...left });
        }}
      />
      <div className={symmetric ? "mt-2" : "mt-2 grid gap-3 sm:grid-cols-2"}>
        <SideEditor title={symmetric ? "Pro Seite" : "Links"} sizes={sorted} counts={left} onChange={setLeft} />
        {!symmetric && <SideEditor title="Rechts" sizes={sorted} counts={right} onChange={setRight} />}
      </div>
      <div className="mt-3 rounded-xl bg-surface-2 p-3" aria-live="polite">
        <p className="text-sm text-muted">Scheibengewicht gesamt</p>
        <p className="tabular text-2xl font-semibold">{formatKg(total)}</p>
        {symmetric && <p className="text-xs text-muted">= 2 × {formatKg(sideWeight(load.left))}</p>}
        {includeStartWeight && startWeightKg !== undefined && (
          <p className="mt-1 text-sm">
            Dokumentiert inkl. verifiziertem Startgewicht ({formatKg(startWeightKg)}):{" "}
            <strong>{formatKg(documented)}</strong>
          </p>
        )}
        {unbalanced && (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-warning" role="alert">
            <AlertTriangle className="size-4" aria-hidden /> Ungleiche Beladung: links{" "}
            {formatKg(sideWeight(load.left))}, rechts {formatKg(sideWeight(load.right))}
          </p>
        )}
      </div>
    </Dialog>
  );
}
