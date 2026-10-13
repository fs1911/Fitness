"use client";
import { useLiveQuery } from "dexie-react-hooks";
import * as React from "react";
import { db, repos } from "@/data";
import type { Device, Exercise } from "@/domain/types";

/** Live-Abfrage, die `null` statt `undefined` für „nicht vorhanden“ liefert (undefined = lädt). */
export function useLive<T>(query: () => Promise<T | undefined> | T | undefined, deps: unknown[] = []) {
  return useLiveQuery(async () => (await query()) ?? null, deps);
}

export function useActiveSession() {
  return useLive(() => repos.sessions.getActive());
}

export function useDeviceMap(): Map<string, Device> | undefined {
  const list = useLiveQuery(() => db.devices.toArray(), []);
  return React.useMemo(() => (list ? new Map(list.map((d) => [d.id, d])) : undefined), [list]);
}

export function useExerciseMap(): Map<string, Exercise> | undefined {
  const list = useLiveQuery(() => db.exercises.toArray(), []);
  return React.useMemo(() => (list ? new Map(list.map((e) => [e.id, e])) : undefined), [list]);
}

export function useSettings() {
  return useLiveQuery(() => repos.settings.get(), []);
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
