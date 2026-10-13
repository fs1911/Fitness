"use client";
import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { repos } from "@/data";
import { ActiveSessionExistsError } from "@/data/repositories/sessions";
import { formatTime } from "@/domain/format";
import type { WorkoutTemplate } from "@/domain/types";
import { useActiveSession } from "@/hooks/useData";

export function StartTrainingButton({
  template,
  suggested,
  exerciseCount,
}: {
  template: WorkoutTemplate;
  suggested: boolean;
  exerciseCount: number;
}) {
  const router = useRouter();
  const active = useActiveSession();
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start() {
    if (busy) return;
    if (active) {
      setConflictOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repos.sessions.start(template.id);
      router.push("/training/");
    } catch (e) {
      if (e instanceof ActiveSessionExistsError) setConflictOpen(true);
      else setError(e instanceof Error ? e.message : "Start fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left hover:border-accent/60 disabled:opacity-50"
      >
        <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent text-2xl font-bold text-accent-foreground">
          {template.split}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">Training {template.split}</span>
            {suggested && <Badge tone="accent">Vorschlag</Badge>}
          </span>
          <span className="block text-sm text-muted">
            {template.description} · {exerciseCount} Übungen
          </span>
        </span>
        <Play className="size-6 shrink-0 text-accent" aria-hidden />
        <span className="sr-only">starten</span>
      </button>
      {error && (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        title="Es läuft bereits ein Training"
        description={
          active
            ? `${active.templateName} (gestartet ${formatTime(active.startedAt)}) ist noch nicht abgeschlossen. Du kannst es fortsetzen – oder es als „Abgebrochen“ markieren und Training ${template.split} neu starten.`
            : "Ein anderes Training läuft noch."
        }
        confirmLabel={`Abbrechen & Training ${template.split} starten`}
        danger
        onConfirm={async () => {
          if (active) await repos.sessions.abort(active.id);
          await repos.sessions.start(template.id);
          router.push("/training/");
        }}
      />
    </div>
  );
}
