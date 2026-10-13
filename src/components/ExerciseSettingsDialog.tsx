"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { repos } from "@/data";
import { SETTING_LABELS, type SettingFields } from "@/data/repositories/exercises";

const FIELDS: (keyof SettingFields)[] = ["seatHeight", "startPosition", "backrest", "grip"];

/** Persönliche Einstellungsnotizen – getrennt je Übung UND Gerät. */
export function ExerciseSettingsDialog({
  open,
  onOpenChange,
  exerciseId,
  deviceId,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exerciseId: string;
  deviceId: string;
  title: string;
}) {
  const [values, setValues] = React.useState<SettingFields>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    repos.exercises.getSetting(exerciseId, deviceId).then((s) =>
      setValues({
        seatHeight: s?.seatHeight ?? "",
        startPosition: s?.startPosition ?? "",
        backrest: s?.backrest ?? "",
        grip: s?.grip ?? "",
        notes: s?.notes ?? "",
      }),
    );
  }, [open, exerciseId, deviceId]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Einstellungen: ${title}`}
      description="Gilt nur für diese Übung an diesem Gerät. Bereits abgeschlossene Trainings behalten ihre damaligen Notizen."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await repos.exercises.saveSetting(exerciseId, deviceId, values);
              setSaving(false);
              onOpenChange(false);
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((k) => (
          <Field key={k} label={SETTING_LABELS[k]} htmlFor={`set-${k}`}>
            <Input
              id={`set-${k}`}
              value={values[k] ?? ""}
              maxLength={40}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      <Field label={SETTING_LABELS.notes} htmlFor="set-notes" className="mt-3">
        <Textarea
          id="set-notes"
          value={values.notes ?? ""}
          maxLength={300}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
        />
      </Field>
    </Dialog>
  );
}
