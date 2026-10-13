"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { DeviceImage } from "@/components/DeviceImage";
import { ExercisePicker } from "@/components/training/ExercisePicker";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { repos } from "@/data";
import { TEMPLATE_A_ID, TEMPLATE_B_ID } from "@/data/seed/seed";
import { MUSCLE_GROUP_LABELS, type MuscleGroup, type TemplateSlot, type WorkoutTemplate } from "@/domain/types";
import { useDeviceMap, useExerciseMap } from "@/hooks/useData";

export default function PlanPage() {
  const [tplId, setTplId] = React.useState(TEMPLATE_A_ID);
  const tpl = useLiveQuery(() => repos.templates.get(tplId), [tplId]);
  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">Trainingsplan</h1>
      <Segmented
        label="Vorlage wählen"
        value={tplId}
        onChange={setTplId}
        options={[
          { value: TEMPLATE_A_ID, label: "Training A" },
          { value: TEMPLATE_B_ID, label: "Training B" },
        ]}
      />
      {tpl && <TemplateEditor template={tpl} />}
    </div>
  );
}

function TemplateEditor({ template }: { template: WorkoutTemplate }) {
  const slots = useLiveQuery(() => repos.templates.slots(template.id), [template.id]);
  const exercises = useExerciseMap();
  const devices = useDeviceMap();
  const [addOpen, setAddOpen] = React.useState(false);
  const [newExerciseOpen, setNewExerciseOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TemplateSlot | null>(null);
  const [removing, setRemoving] = React.useState<TemplateSlot | null>(null);

  if (!slots || !exercises || !devices) return <p className="py-6 text-muted">Lädt …</p>;

  return (
    <div className="mt-4">
      <p className="text-lg font-semibold">{template.name}</p>
      <p className="text-sm text-muted">
        Muskelgruppen: {template.allowedMuscleGroups.map((m) => MUSCLE_GROUP_LABELS[m]).join(", ")}
      </p>
      <p className="mt-1 text-xs text-muted">
        Editierbare App-Vorlage, keine individuelle Trainingsempfehlung. Änderungen wirken nur auf zukünftige
        Trainings – abgeschlossene Einheiten bleiben unverändert.
      </p>

      {slots.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Keine Übungen in dieser Vorlage" />
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {slots.map((slot, i) => {
            const ex = exercises.get(slot.exerciseId);
            const device = ex ? devices.get(ex.deviceId) : undefined;
            const alts = slot.alternativeExerciseIds.map((id) => exercises.get(id)).filter(Boolean);
            return (
              <li key={slot.id}>
                <Card className={slot.active ? "p-3" : "p-3 opacity-60"}>
                  <div className="flex gap-3">
                    <DeviceImage device={device} size="thumb" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        {i + 1}. {slot.label ?? (ex ? MUSCLE_GROUP_LABELS[ex.muscleGroup] : "")}
                      </p>
                      <p className="font-semibold">
                        {ex?.name ?? "Unbekannte Übung"}
                        {ex?.variantLabel ? ` (${ex.variantLabel})` : ""}
                      </p>
                      <p className="truncate text-sm text-muted">
                        {device ? device.name : "Kein Gerät zugeordnet"}
                        {device?.archivedAt ? " (archiviert)" : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone="accent">
                          {slot.targetSets} × {slot.targetRepsMin}
                          {slot.targetRepsMax !== slot.targetRepsMin ? `–${slot.targetRepsMax}` : ""}
                        </Badge>
                        {slot.restSeconds ? <Badge>Pause {slot.restSeconds} s</Badge> : null}
                        {!slot.active && (
                          <Badge tone="warning">
                            <EyeOff aria-hidden /> Deaktiviert
                          </Badge>
                        )}
                      </div>
                      {alts.length > 0 && (
                        <p className="mt-1 text-xs text-muted">Alternative: {alts.map((a) => a!.name).join(", ")}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(slot)}>
                      <Pencil aria-hidden /> Bearbeiten
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`${ex?.name} nach oben`}
                      disabled={i === 0}
                      onClick={() => repos.templates.moveSlot(slot.id, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`${ex?.name} nach unten`}
                      disabled={i === slots.length - 1}
                      onClick={() => repos.templates.moveSlot(slot.id, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => repos.templates.updateSlot(slot.id, { active: !slot.active })}
                    >
                      {slot.active ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="ml-auto text-muted hover:text-danger"
                      aria-label={`${ex?.name} entfernen`}
                      onClick={() => setRemoving(slot)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden /> Bestehende Übung hinzufügen
        </Button>
        <Button variant="outline" onClick={() => setNewExerciseOpen(true)}>
          <Plus aria-hidden /> Neue Übung anlegen
        </Button>
      </div>

      <ExercisePicker
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Übung hinzufügen"
        allowedMuscleGroups={template.allowedMuscleGroups}
        onPick={(id) =>
          repos.templates.addSlot(template.id, { exerciseId: id, targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, restSeconds: 90 })
        }
      />

      {newExerciseOpen && <NewExerciseDialog open onOpenChange={setNewExerciseOpen} template={template} />}

      {editing && (
        <SlotDialog
          slot={editing}
          template={template}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Übung aus Vorlage entfernen?"
        description="Die Übung und ihre Historie bleiben erhalten. Sie wird nur in zukünftigen Trainings nicht mehr vorgeschlagen."
        confirmLabel="Entfernen"
        danger
        onConfirm={async () => {
          if (removing) await repos.templates.removeSlot(removing.id);
        }}
      />
    </div>
  );
}

function intOrUndef(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function SlotDialog({
  slot,
  template,
  onClose,
}: {
  slot: TemplateSlot;
  template: WorkoutTemplate;
  onClose: () => void;
}) {
  const exercises = useExerciseMap();
  const devices = useDeviceMap();
  const [exerciseId, setExerciseId] = React.useState(slot.exerciseId);
  const [alts, setAlts] = React.useState<string[]>(slot.alternativeExerciseIds);
  const [label, setLabel] = React.useState(slot.label ?? "");
  const [sets, setSets] = React.useState(String(slot.targetSets));
  const [repsMin, setRepsMin] = React.useState(String(slot.targetRepsMin));
  const [repsMax, setRepsMax] = React.useState(String(slot.targetRepsMax));
  const [rest, setRest] = React.useState(slot.restSeconds === undefined ? "" : String(slot.restSeconds));
  const [error, setError] = React.useState<string | null>(null);
  const ex = exercises?.get(exerciseId);
  const [deviceId, setDeviceId] = React.useState<string | undefined>(undefined);
  const currentDeviceId = deviceId ?? ex?.deviceId;

  const candidates = [...(exercises?.values() ?? [])].filter(
    (e) => !e.archivedAt && template.allowedMuscleGroups.includes(e.muscleGroup),
  );
  const deviceOptions = [...(devices?.values() ?? [])].filter(
    // Alle Geräte des Splits – erlaubt z. B. Reverse Butterfly an der Butterfly-Kombimaschine.
    (d) => (!d.archivedAt || d.id === ex?.deviceId) && template.allowedMuscleGroups.includes(d.muscleGroup),
  );

  async function save() {
    try {
      const restVal = intOrUndef(rest);
      if (deviceId && ex && deviceId !== ex.deviceId) {
        await repos.exercises.update(ex.id, { deviceId });
      }
      await repos.templates.updateSlot(slot.id, {
        exerciseId,
        alternativeExerciseIds: alts.filter((a) => a !== exerciseId),
        label,
        targetSets: Number(sets),
        targetRepsMin: Number(repsMin),
        targetRepsMax: Number(repsMax),
        restSeconds: restVal,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Übungsposition bearbeiten"
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Übung (ersetzen)" htmlFor="slot-ex">
          <Select
            id="slot-ex"
            value={exerciseId}
            onChange={(e) => {
              setExerciseId(e.target.value);
              setDeviceId(undefined);
            }}
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {MUSCLE_GROUP_LABELS[c.muscleGroup]} · {c.name}
                {c.variantLabel ? ` (${c.variantLabel})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Zugeordnetes Gerät"
          htmlFor="slot-dev"
          hint="Gilt für diese Übung überall. Bisherige Sätze behalten ihr damaliges Gerät; Fortschritt wird je Gerät getrennt geführt."
        >
          <Select id="slot-dev" value={currentDeviceId ?? ""} onChange={(e) => setDeviceId(e.target.value)}>
            {deviceOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.model ? ` (${d.model})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bezeichnung der Position (optional)" htmlFor="slot-label">
          <Input id="slot-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Beinpresse" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Sätze" htmlFor="slot-sets">
            <Input id="slot-sets" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
          <Field label="Wdh. min." htmlFor="slot-rmin">
            <Input id="slot-rmin" inputMode="numeric" value={repsMin} onChange={(e) => setRepsMin(e.target.value)} />
          </Field>
          <Field label="Wdh. max." htmlFor="slot-rmax">
            <Input id="slot-rmax" inputMode="numeric" value={repsMax} onChange={(e) => setRepsMax(e.target.value)} />
          </Field>
        </div>
        <Field label="Pausenzeit in Sekunden (optional)" htmlFor="slot-rest">
          <Input id="slot-rest" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} placeholder="leer = keine" />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-muted">Alternative Übungen (während des Trainings wählbar)</legend>
          {candidates
            .filter((c) => c.id !== exerciseId && ex && c.muscleGroup === ex.muscleGroup)
            .map((c) => (
              <Checkbox
                key={c.id}
                label={`${c.name}${c.variantLabel ? ` (${c.variantLabel})` : ""}`}
                checked={alts.includes(c.id)}
                onChange={(e) => setAlts((a) => (e.target.checked ? [...a, c.id] : a.filter((x) => x !== c.id)))}
              />
            ))}
        </fieldset>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function NewExerciseDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: WorkoutTemplate;
}) {
  const devices = useDeviceMap();
  const [name, setName] = React.useState("");
  const [variant, setVariant] = React.useState("");
  const [mg, setMg] = React.useState<MuscleGroup>(template.allowedMuscleGroups[0]);
  const [deviceId, setDeviceId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const deviceOptions = [...(devices?.values() ?? [])].filter((d) => !d.archivedAt && d.muscleGroup === mg);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Neue Übung anlegen"
      description={`Wird ${template.name} hinzugefügt.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            variant="primary"
            onClick={async () => {
              try {
                const dev = deviceId || deviceOptions[0]?.id;
                if (!dev) throw new Error("Bitte zuerst ein Gerät dieser Muskelgruppe anlegen.");
                const ex = await repos.exercises.create({ name, muscleGroup: mg, deviceId: dev, variantLabel: variant });
                await repos.templates.addSlot(template.id, {
                  exerciseId: ex.id,
                  targetSets: 3,
                  targetRepsMin: 10,
                  targetRepsMax: 12,
                  restSeconds: 90,
                });
                onOpenChange(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Fehler");
              }
            }}
          >
            Anlegen
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name" htmlFor="ne-name">
          <Input id="ne-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Ausführungsvariante (optional)" htmlFor="ne-var" hint="z. B. sitzend, liegend, enger Griff – eigene Historie.">
          <Input id="ne-var" value={variant} onChange={(e) => setVariant(e.target.value)} />
        </Field>
        <Field label="Muskelgruppe" htmlFor="ne-mg">
          <Select id="ne-mg" value={mg} onChange={(e) => setMg(e.target.value as MuscleGroup)}>
            {template.allowedMuscleGroups.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_GROUP_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Gerät" htmlFor="ne-dev">
          <Select id="ne-dev" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {deviceOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
