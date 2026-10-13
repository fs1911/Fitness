"use client";
import { Timer, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { repos } from "@/data";
import { formatClock } from "@/domain/format";
import type { WorkoutSession } from "@/domain/types";
import { useNow } from "@/hooks/useData";

/** Pausentimer auf Basis der Uhrzeit – läuft auch nach Neuladen korrekt weiter. */
export function RestTimer({ session }: { session: WorkoutSession }) {
  const now = useNow(250);
  const timer = session.restTimer;
  const remaining = timer ? timer.endsAt - now : 0;
  const done = !!timer && remaining <= 0;
  const notified = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (done && timer && notified.current !== timer.endsAt) {
      notified.current = timer.endsAt;
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* nicht unterstützt */
      }
    }
  }, [done, timer]);

  if (!timer) return null;
  return (
    <div
      role="timer"
      aria-live={done ? "assertive" : "off"}
      className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${done ? "border-accent bg-accent/15" : "border-border bg-surface-2"}`}
    >
      <Timer className="size-5 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{done ? "Pause vorbei" : "Pause"}</p>
        <p className="tabular text-xl font-semibold">{done ? "Weiter geht’s" : formatClock(remaining)}</p>
      </div>
      {!done && (
        <>
          <Button size="sm" variant="ghost" onClick={() => repos.sessions.adjustRestTimer(session.id, -15)}>
            −15 s
          </Button>
          <Button size="sm" variant="ghost" onClick={() => repos.sessions.adjustRestTimer(session.id, 15)}>
            +15 s
          </Button>
        </>
      )}
      <Button size="icon-sm" variant="ghost" aria-label="Pausentimer beenden" onClick={() => repos.sessions.clearRestTimer(session.id)}>
        <X />
      </Button>
    </div>
  );
}
