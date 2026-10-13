"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { Archive, ArchiveRestore, ArrowLeft, ImagePlus, Link2, RotateCcw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DeviceImage } from "@/components/DeviceImage";
import { ExerciseSettingsDialog } from "@/components/ExerciseSettingsDialog";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { repos } from "@/data";
import { settingsToText } from "@/data/repositories/exercises";
import type { DeviceInput } from "@/data/repositories/devices";
import { formatKg } from "@/domain/format";
import { parseWeight } from "@/domain/parse";
import {
  LOADING_TYPE_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  type Device,
  type Exercise,
  type LoadingType,
  type MuscleGroup,
} from "@/domain/types";
import { useLive } from "@/hooks/useData";
import { useQueryParam } from "@/hooks/useQueryParam";
import { resizeImage } from "@/lib/utils";

export default function DeviceEditPage() {
  return (
    <React.Suspense fallback={<p className="py-10 text-center text-muted">Lädt …</p>}>
      <DeviceEdit />
    </React.Suspense>
  );
}

function DeviceEdit() {
  const id = useQueryParam("id");
  const device = useLive(() => (id ? repos.devices.get(id) : undefined), [id]);
  if (id && device === undefined) return <p className="py-10 text-center text-muted">Lädt …</p>;
  return <DeviceForm key={device?.id ?? "new"} device={device ?? undefined} />;
}

function numStr(n: number | undefined) {
  return n === undefined ? "" : String(n);
}

function DeviceForm({ device }: { device?: Device }) {
  const router = useRouter();
  const isNew = !device;
  const [name, setName] = React.useState(device?.name ?? "Cybex ");
  const [model, setModel] = React.useState(device?.model ?? "");
  const [series, setSeries] = React.useState(device?.series ?? "");
  const [mg, setMg] = React.useState<MuscleGroup>(device?.muscleGroup ?? "brust");
  const [loading, setLoading] = React.useState<LoadingType>(device?.loadingType ?? "selectorized");
  const [description, setDescription] = React.useState(device?.description ?? "");
  const [increment, setIncrement] = React.useState(numStr(device?.weightIncrementKg));
  const [stepsNote, setStepsNote] = React.useState(device?.weightStepsNote ?? "");
  const [plates, setPlates] = React.useState(device?.availablePlatesKg?.join("; ") ?? "");
  const [startWeight, setStartWeight] = React.useState(numStr(device?.startWeightKg));
  const [includeStart, setIncludeStart] = React.useState(device?.includeStartWeight ?? false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  function parseOptional(label: string, s: string): number | undefined {
    const r = parseWeight(s);
    if (!r.ok) throw new Error(`${label}: ${r.error}`);
    return r.value ?? undefined;
  }

  async function save() {
    setError(null);
    setSaved(false);
    try {
      const plateList = plates
        .split(/[;\s]+/)
        .filter(Boolean)
        .map((p) => {
          const r = parseWeight(p);
          if (!r.ok || r.value === null || r.value <= 0) throw new Error(`Ungültige Scheibengrösse: „${p}“`);
          return r.value;
        });
      const input: DeviceInput = {
        name,
        model,
        series,
        muscleGroup: mg,
        loadingType: loading,
        description,
        weightIncrementKg: parseOptional("Gewichtsabstufung", increment),
        weightStepsNote: stepsNote,
        availablePlatesKg: loading === "plate_loaded" && plateList.length ? plateList : undefined,
        startWeightKg: loading === "plate_loaded" ? parseOptional("Startgewicht", startWeight) : undefined,
        includeStartWeight: loading === "plate_loaded" ? includeStart : false,
      };
      if (isNew) {
        const created = await repos.devices.create(input);
        router.replace(`/geraete/bearbeiten/?id=${created.id}`);
      } else {
        await repos.devices.update(device.id, input);
        setSaved(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <div>
      <Link href="/geraete/" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted">
        <ArrowLeft className="size-4" aria-hidden /> Geräte
      </Link>
      <h1 className="text-2xl font-semibold">{isNew ? "Neues Gerät" : device.name}</h1>
      {device?.archivedAt && (
        <p className="mt-2 rounded-xl border border-danger/50 p-3 text-sm">
          Archiviert – wird in Auswahlen nicht mehr angeboten, bleibt in der Historie sichtbar.
        </p>
      )}

      {device && <ImageSection device={device} />}

      <SectionTitle>Stammdaten</SectionTitle>
      <div className="space-y-3">
        <Field label="Gerätename" htmlFor="d-name">
          <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Modell" htmlFor="d-model" hint="Nur verifizierte Angaben eintragen.">
            <Input id="d-model" value={model} placeholder="noch nicht hinterlegt" onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="Serie" htmlFor="d-series">
            <Input id="d-series" value={series} placeholder="optional" onChange={(e) => setSeries(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted">Marke: Cybex</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Muskelgruppe" htmlFor="d-mg">
            <Select id="d-mg" value={mg} onChange={(e) => setMg(e.target.value as MuscleGroup)}>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_GROUP_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Beladungsart" htmlFor="d-load">
            <Select id="d-load" value={loading} onChange={(e) => setLoading(e.target.value as LoadingType)}>
              {(Object.keys(LOADING_TYPE_LABELS) as LoadingType[]).map((l) => (
                <option key={l} value={l}>
                  {LOADING_TYPE_LABELS[l]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Beschreibung (optional)" htmlFor="d-desc">
          <Textarea id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {loading === "selectorized" ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Gewichtsabstufung (kg)" htmlFor="d-inc">
              <Input id="d-inc" inputMode="decimal" value={increment} onChange={(e) => setIncrement(e.target.value)} placeholder="z. B. 5" />
            </Field>
            <Field label="Notiz zur Abstufung" htmlFor="d-steps">
              <Input id="d-steps" value={stepsNote} onChange={(e) => setStepsNote(e.target.value)} placeholder="z. B. Zusatzgewicht 2,5 kg" />
            </Field>
          </div>
        ) : (
          <Card className="space-y-3 p-3">
            <Field
              label="Verfügbare Scheiben (kg, mit ; getrennt)"
              htmlFor="d-plates"
              hint="Leer = Standard aus den Einstellungen."
            >
              <Input id="d-plates" value={plates} onChange={(e) => setPlates(e.target.value)} placeholder="z. B. 25; 20; 10; 5; 2,5" />
            </Field>
            <Field
              label="Verifiziertes Startgewicht / Schlittengewicht (kg, optional)"
              htmlFor="d-start"
              hint="Nur eintragen, wenn der Wert gesichert ist (z. B. Herstellerangabe am Gerät). Nicht schätzen."
            >
              <Input id="d-start" inputMode="decimal" value={startWeight} onChange={(e) => setStartWeight(e.target.value)} />
            </Field>
            {startWeight.trim() && (
              <Checkbox
                label="Startgewicht in die dokumentierte Gewichtskennzahl einrechnen"
                checked={includeStart}
                onChange={(e) => setIncludeStart(e.target.checked)}
              />
            )}
            <p className="text-xs text-muted">
              Die Grundlage wird pro Satz gespeichert. Eine spätere Änderung interpretiert alte Sätze nicht neu;
              Sätze mit und ohne Startgewicht bilden getrennte Vergleichsreihen. Die Kennzahl ist keine effektive Kraft
              und kein mechanischer Widerstand.
            </p>
          </Card>
        )}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-sm text-success" role="status">
            ✓ Gespeichert
          </p>
        )}
        <Button variant="primary" className="w-full" onClick={save}>
          {isNew ? "Gerät anlegen" : "Änderungen speichern"}
        </Button>
      </div>

      {device && <ExercisesForDevice device={device} />}

      {device && (
        <div className="mt-6">
          {device.archivedAt ? (
            <Button className="w-full" onClick={() => repos.devices.unarchive(device.id)}>
              <ArchiveRestore aria-hidden /> Wiederherstellen
            </Button>
          ) : (
            <Button variant="danger-outline" className="w-full" onClick={() => setArchiveOpen(true)}>
              <Archive aria-hidden /> Archivieren
            </Button>
          )}
          <ConfirmDialog
            open={archiveOpen}
            onOpenChange={setArchiveOpen}
            title="Gerät archivieren?"
            description="Das Gerät wird nicht gelöscht. Bisherige Trainings zeigen es weiterhin korrekt an. Übungen, die es nutzen, solltest du einem anderen Gerät zuordnen."
            confirmLabel="Archivieren"
            onConfirm={() => repos.devices.archive(device.id)}
          />
        </div>
      )}
    </div>
  );
}

function ImageSection({ device }: { device: Device }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [urlOpen, setUrlOpen] = React.useState(false);
  const [url, setUrl] = React.useState(device.image.kind === "url" ? device.image.url : "");
  const [source, setSource] = React.useState(device.image.kind === "url" ? device.image.source : "");
  const [license, setLicense] = React.useState(device.image.kind === "url" ? device.image.license ?? "" : "");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <div className="mt-4">
      <DeviceImage device={device} size="hero" />
      {device.image.kind === "url" && (
        <p className="mt-1 text-xs text-muted">
          Quelle: {device.image.source}
          {device.image.license ? ` · Nutzungsrecht: ${device.image.license}` : ""}
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus aria-hidden /> {device.image.kind === "upload" ? "Foto ersetzen" : "Eigenes Foto"}
        </Button>
        <Button onClick={() => setUrlOpen((o) => !o)} aria-expanded={urlOpen}>
          <Link2 aria-hidden /> Bild-URL
        </Button>
      </div>
      {device.image.kind !== "illustration" && (
        <Button variant="ghost" size="sm" className="mt-1" onClick={() => repos.devices.resetImage(device.id)}>
          <RotateCcw aria-hidden /> Zur Illustration zurück
        </Button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Gerätefoto hochladen"
        data-testid="device-image-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const { data, mimeType } = await resizeImage(file);
            await repos.devices.setUploadedImage(device.id, data, mimeType, file.name);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {urlOpen && (
        <Card className="mt-2 space-y-2 p-3">
          <p className="text-xs text-muted">
            Externe Produktbilder nur verwenden, wenn Quelle und Nutzungsberechtigung geklärt sind. Das Bild wird bei
            jedem Anzeigen aus dem Internet geladen und ist nicht im Backup enthalten.
          </p>
          <Field label="Bild-URL" htmlFor="img-url">
            <Input id="img-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Quelle (Pflicht)" htmlFor="img-src">
            <Input id="img-src" value={source} onChange={(e) => setSource(e.target.value)} placeholder="z. B. eigenes Foto, Website des Studios" />
          </Field>
          <Field label="Nutzungsberechtigung" htmlFor="img-lic">
            <Input id="img-lic" value={license} onChange={(e) => setLicense(e.target.value)} placeholder="z. B. mit Erlaubnis von …" />
          </Field>
          <Button
            variant="primary"
            className="w-full"
            onClick={async () => {
              try {
                await repos.devices.setImageUrl(device.id, url, source, license);
                setError(null);
                setUrlOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Fehler");
              }
            }}
          >
            Bild-URL speichern
          </Button>
        </Card>
      )}
      {error && (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ExercisesForDevice({ device }: { device: Device }) {
  const exercises = useLiveQuery(() => repos.exercises.byDevice(device.id), [device.id]);
  const settings = useLiveQuery(() => repos.db.exerciseSettings.where("deviceId").equals(device.id).toArray(), [device.id]);
  const [editing, setEditing] = React.useState<Exercise | null>(null);
  if (!exercises || !settings) return null;
  return (
    <>
      <SectionTitle>Übungen an diesem Gerät</SectionTitle>
      {exercises.length === 0 ? (
        <p className="text-sm text-muted">Keine Übung zugeordnet. Zuordnung über Trainingsplan → Bearbeiten.</p>
      ) : (
        <ul className="space-y-2">
          {exercises.map((e) => {
            const text = settingsToText(settings.find((s) => s.exerciseId === e.id));
            return (
              <li key={e.id}>
                <Card className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {e.name}
                        {e.variantLabel ? ` (${e.variantLabel})` : ""}
                      </p>
                      <p className="text-sm text-muted">{text || "Noch keine persönlichen Einstellungen."}</p>
                    </div>
                    <Button size="sm" onClick={() => setEditing(e)}>
                      <SlidersHorizontal aria-hidden /> Einstellungen
                    </Button>
                  </div>
                  <VariantLabelEditor exercise={e} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {exercises.length > 1 && (
        <p className="mt-2 text-xs text-muted">
          Mehrere Übungen an einem Gerät (z. B. Kombimaschine) führen getrennte Historien, Einstellungen und Bestleistungen.
        </p>
      )}
      {device.weightIncrementKg !== undefined && (
        <p className="mt-2 text-xs text-muted">Gewichtsabstufung: {formatKg(device.weightIncrementKg)}</p>
      )}
      {editing && (
        <ExerciseSettingsDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          exerciseId={editing.id}
          deviceId={device.id}
          title={editing.name}
        />
      )}
    </>
  );
}

function VariantLabelEditor({ exercise }: { exercise: Exercise }) {
  const [value, setValue] = React.useState(exercise.variantLabel ?? "");
  return (
    <div className="mt-2">
      <Field label="Ausführung / Variante" htmlFor={`var-${exercise.id}`} hint="z. B. sitzend oder liegend. Für eine zweite Ausführung mit eigener Historie im Trainingsplan eine neue Übung anlegen.">
        <Input
          id={`var-${exercise.id}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => value !== (exercise.variantLabel ?? "") && repos.exercises.update(exercise.id, { variantLabel: value })}
        />
      </Field>
    </div>
  );
}
