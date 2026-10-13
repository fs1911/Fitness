"use client";
import { Download, FileJson, FileSpreadsheet, HardDrive, Upload } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { repos } from "@/data";
import type { Backup } from "@/data/repositories/backup";
import { formatDate, formatDateTime, toDateInputValue } from "@/domain/format";
import { parseWeight } from "@/domain/parse";
import { useSettings } from "@/hooks/useData";
import { downloadText } from "@/lib/utils";

export default function SettingsPage() {
  const settings = useSettings();
  const [plates, setPlates] = React.useState<string | null>(null);
  const [rest, setRest] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pendingImport, setPendingImport] = React.useState<Backup | null>(null);
  const [importErrors, setImportErrors] = React.useState<string[]>([]);
  const [storage, setStorage] = React.useState<{ persisted: boolean | null; usage?: number; quota?: number }>({
    persisted: null,
  });
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const persisted = (await navigator.storage?.persisted?.()) ?? null;
        const est = await navigator.storage?.estimate?.();
        setStorage({ persisted, usage: est?.usage, quota: est?.quota });
      } catch {
        /* nicht unterstützt */
      }
    })();
  }, []);

  if (!settings) return <p className="py-10 text-center text-muted">Lädt …</p>;
  const platesValue = plates ?? settings.availablePlatesKg.join("; ");
  const restValue = rest ?? String(settings.defaultRestSeconds);

  async function saveTraining() {
    try {
      const list = platesValue
        .split(/[;\s]+/)
        .filter(Boolean)
        .map((p) => {
          const r = parseWeight(p);
          if (!r.ok || r.value === null || r.value <= 0) throw new Error(`Ungültige Scheibengrösse: „${p}“`);
          return r.value;
        });
      if (list.length === 0) throw new Error("Mindestens eine Scheibengrösse angeben.");
      const restN = Number(restValue);
      if (!Number.isInteger(restN) || restN < 0) throw new Error("Pausenzeit: ganze Sekunden ≥ 0.");
      await repos.settings.update({ availablePlatesKg: list, defaultRestSeconds: restN });
      setPlates(null);
      setRest(null);
      setMsg({ tone: "ok", text: "Einstellungen gespeichert." });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Fehler" });
    }
  }

  const stamp = toDateInputValue(new Date());

  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">Einstellungen</h1>

      <SectionTitle>Training</SectionTitle>
      <Card className="space-y-3">
        <Field
          label="Verfügbare Scheibengrössen (kg, mit ; getrennt)"
          htmlFor="s-plates"
          hint="Für den Scheibenrechner. Gerätespezifische Werte haben Vorrang."
        >
          <Input id="s-plates" value={platesValue} onChange={(e) => setPlates(e.target.value)} />
        </Field>
        <Field label="Standard-Pausenzeit (Sekunden)" htmlFor="s-rest" hint="Gilt, wenn die Übung keine eigene Pausenzeit hat.">
          <Input id="s-rest" inputMode="numeric" value={restValue} onChange={(e) => setRest(e.target.value)} />
        </Field>
        <Button variant="primary" onClick={saveTraining}>
          Speichern
        </Button>
        <Checkbox
          label="Pausentimer nach abgeschlossenem Satz starten"
          checked={settings.restTimerEnabled}
          onChange={(e) => repos.settings.update({ restTimerEnabled: e.target.checked })}
        />
        <Checkbox
          label="Aufwärmsätze im Trainingsvolumen mitzählen (Standard: nein)"
          checked={settings.includeWarmupInVolume}
          onChange={(e) => repos.settings.update({ includeWarmupInVolume: e.target.checked })}
        />
        {msg && (
          <p className={msg.tone === "ok" ? "text-sm text-success" : "text-sm text-danger"} role={msg.tone === "ok" ? "status" : "alert"}>
            {msg.text}
          </p>
        )}
      </Card>

      <SectionTitle>
        <span id="backup">Datensicherung</span>
      </SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm">
          <HardDrive className="mr-1 inline size-4 text-warning" aria-hidden />
          Deine Daten liegen <strong>nur in diesem Browser auf diesem Gerät</strong>. Es gibt keine Cloud-Synchronisierung.
          Erstelle regelmässig ein Backup.
        </p>
        <p className="text-xs text-muted">
          Letztes Backup: {settings.lastBackupAt ? formatDateTime(settings.lastBackupAt) : "noch keines"}
          {storage.persisted !== null &&
            ` · Speicher ${storage.persisted ? "als dauerhaft markiert" : "nicht dauerhaft – Browser darf ihn bei Platzmangel löschen"}`}
          {storage.usage !== undefined && ` · belegt ca. ${(storage.usage / 1024 / 1024).toFixed(1)} MB`}
        </p>
        <Button
          variant="primary"
          className="w-full"
          onClick={async () => {
            const json = await repos.backup.exportBackupJson();
            downloadText(`zweier-split-backup-${stamp}.json`, json, "application/json");
          }}
        >
          <FileJson aria-hidden /> Vollständiges Backup (JSON, inkl. eigener Fotos)
        </Button>
        <Button
          className="w-full"
          onClick={async () => {
            const csv = await repos.backup.exportCsv();
            downloadText(`zweier-split-saetze-${stamp}.csv`, csv, "text/csv;charset=utf-8");
          }}
        >
          <FileSpreadsheet aria-hidden /> Trainings &amp; Sätze als CSV
        </Button>
        <Button className="w-full" onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden /> Backup importieren …
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Backup-Datei wählen"
          data-testid="backup-input"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const result = repos.backup.parseBackup(await file.text());
            if (result.ok) {
              setImportErrors([]);
              setPendingImport(result.backup);
            } else {
              setImportErrors(result.errors);
            }
          }}
        />
        {importErrors.length > 0 && (
          <div role="alert" className="rounded-xl border border-danger/60 p-3 text-sm">
            <p className="font-medium text-danger">Import abgelehnt – die Datei ist kein gültiges Backup:</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              {importErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <SectionTitle>Über die App</SectionTitle>
      <Card className="space-y-2 text-sm text-muted">
        <p>
          Zweier-Split: Training A (Brust, Rücken, Schultern, Bizeps, Trizeps, Bauch) und Training B (Beine, Bauch). Vorbereitete
          Cybex-Gerätekategorien ohne verifizierte Modellangaben; Abbildungen sind schematische Illustrationen, keine
          Produktfotos.
        </p>
        <p>
          <Download className="mr-1 inline size-4" aria-hidden />
          Tipp: Über „Zum Home-Bildschirm hinzufügen“ lässt sich die App wie eine native App öffnen.
        </p>
      </Card>

      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(o) => !o && setPendingImport(null)}
        title="Alle lokalen Daten überschreiben?"
        description={
          pendingImport
            ? `Backup vom ${formatDate(pendingImport.exportedAt)}: ${pendingImport.data.sessions.length} Trainings, ${pendingImport.data.devices.length} Geräte, ${pendingImport.data.images.length} Fotos. Alle aktuellen Daten in diesem Browser werden ersetzt. Erstelle vorher ggf. ein Backup der aktuellen Daten.`
            : ""
        }
        confirmLabel="Überschreiben & importieren"
        danger
        onConfirm={async () => {
          if (!pendingImport) return;
          await repos.backup.importBackup(pendingImport);
          setMsg({ tone: "ok", text: "Backup importiert." });
          setPendingImport(null);
        }}
      />
    </div>
  );
}
