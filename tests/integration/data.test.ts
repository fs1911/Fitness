import { describe, expect, it } from "vitest";
import { freshRepos, logSet, sessionExerciseFor } from "../helpers";
import { ensureSeeded, MIGRATION_SHOULDERS, TEMPLATE_A_ID, TEMPLATE_B_ID } from "@/data/seed/seed";
import { SEED_DEVICES } from "@/data/seed/seedData";
import { ActiveSessionExistsError, SetsWouldBeLostError } from "@/data/repositories/sessions";
import { computeVolume } from "@/domain/metrics";
import { totalPlateWeight } from "@/domain/plates";
import { SPLIT_MUSCLE_GROUPS } from "@/domain/types";
import { FitnessDB } from "@/data/db";
import { createRepositories } from "@/data";

describe("Vorbereitete Daten beim ersten Start", () => {
  it("alle 14 vorbereiteten Geräte sind vorhanden, ohne erfundene Modellnummern", async () => {
    const r = await freshRepos();
    const devices = await r.devices.list();
    expect(devices).toHaveLength(14);
    for (const d of SEED_DEVICES) expect(devices.find((x) => x.id === d.id)).toBeTruthy();
    expect(devices.every((d) => d.brand === "Cybex" && d.model === undefined && d.series === undefined)).toBe(true);
    // Jedes Gerät hat eine eigene Illustration – nicht dasselbe Bild für alle.
    expect(new Set(devices.map((d) => d.illustrationKey)).size).toBe(14);
  });

  it("Seed ist idempotent", async () => {
    const r = await freshRepos();
    const { ensureSeeded } = await import("@/data/seed/seed");
    expect(await ensureSeeded(r.db)).toBe(false);
    expect(await r.db.devices.count()).toBe(14);
  });

  it("alle Übungen in Training A und B besitzen eine gültige Gerätezuordnung und passende Muskelgruppen", async () => {
    const r = await freshRepos();
    for (const tplId of [TEMPLATE_A_ID, TEMPLATE_B_ID]) {
      const tpl = (await r.templates.get(tplId))!;
      const slots = await r.templates.slots(tplId);
      for (const slot of slots) {
        for (const exId of [slot.exerciseId, ...slot.alternativeExerciseIds]) {
          const ex = (await r.exercises.get(exId))!;
          expect(await r.devices.get(ex.deviceId)).toBeTruthy();
          expect(SPLIT_MUSCLE_GROUPS[tpl.split]).toContain(ex.muscleGroup);
        }
      }
    }
  });

  it("Training A hat die vorgegebene Reihenfolge, Training B die Beinpresse mit Alternative", async () => {
    const r = await freshRepos();
    const a = await r.templates.slots(TEMPLATE_A_ID);
    expect(a.map((s) => s.exerciseId)).toEqual([
      "ex-chest-press",
      "ex-butterfly",
      "ex-lat-pulldown",
      "ex-row",
      "ex-reverse-butterfly",
      "ex-shoulder-press",
      "ex-biceps-curl",
      "ex-triceps-extension",
      "ex-crunch",
    ]);
    const b = await r.templates.slots(TEMPLATE_B_ID);
    expect(b[0].exerciseId).toBe("ex-leg-press-stack");
    expect(b[0].alternativeExerciseIds).toEqual(["ex-leg-press-plates"]);
    expect(b.map((s) => s.exerciseId).slice(1)).toEqual([
      "ex-leg-extension",
      "ex-leg-curl",
      "ex-calf-raise",
      "ex-crunch",
    ]);
  });
});

describe("Geräte", () => {
  it("Gerät anlegen, bearbeiten und archivieren", async () => {
    const r = await freshRepos();
    const d = await r.devices.create({ name: "Cybex Testgerät", muscleGroup: "brust", loadingType: "selectorized" });
    await r.devices.update(d.id, {
      name: "Cybex Testgerät 2",
      model: "Echtes Modell",
      muscleGroup: "brust",
      loadingType: "selectorized",
      weightIncrementKg: 5,
    });
    const updated = (await r.devices.get(d.id))!;
    expect(updated.name).toBe("Cybex Testgerät 2");
    expect(updated.model).toBe("Echtes Modell");
    expect(updated.weightIncrementKg).toBe(5);
    await r.devices.archive(d.id);
    expect((await r.devices.list()).find((x) => x.id === d.id)).toBeUndefined();
    expect((await r.devices.list({ includeArchived: true })).find((x) => x.id === d.id)).toBeTruthy();
  });

  it("lehnt leere Namen und negative Gewichte ab", async () => {
    const r = await freshRepos();
    await expect(r.devices.create({ name: " ", muscleGroup: "brust", loadingType: "selectorized" })).rejects.toThrow();
    await expect(
      r.devices.create({ name: "X", muscleGroup: "brust", loadingType: "selectorized", weightIncrementKg: -1 }),
    ).rejects.toThrow();
  });

  it("Bild-Upload wird persistent gespeichert und ist austauschbar", async () => {
    const r = await freshRepos();
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]).buffer;
    await r.devices.setUploadedImage("dev-chest-press", bytes, "image/png", "foto.png");
    const d = (await r.devices.get("dev-chest-press"))!;
    expect(d.image.kind).toBe("upload");
    const blobId = (d.image as { blobId: string }).blobId;
    const stored = await r.devices.getImage(blobId);
    expect(new Uint8Array(stored!.data)).toEqual(new Uint8Array(bytes));

    // Neu öffnen (= App neu geladen) → Bild weiterhin vorhanden
    const reopened = new FitnessDB(r.db.name);
    await reopened.open();
    expect(await createRepositories(reopened).devices.getImage(blobId)).toBeTruthy();

    // Austauschen löscht das alte Bild
    await r.devices.setUploadedImage("dev-chest-press", new Uint8Array([1]).buffer, "image/jpeg");
    expect(await r.devices.getImage(blobId)).toBeUndefined();
  });

  it("externe Bild-URL nur mit Quellenangabe", async () => {
    const r = await freshRepos();
    await expect(r.devices.setImageUrl("dev-row", "https://example.com/x.jpg", "")).rejects.toThrow();
    await r.devices.setImageUrl("dev-row", "https://example.com/x.jpg", "Eigenes Foto", "privat");
    expect((await r.devices.get("dev-row"))!.image).toEqual({
      kind: "url",
      url: "https://example.com/x.jpg",
      source: "Eigenes Foto",
      license: "privat",
    });
  });

  it("archivierte Geräte bleiben in der Trainingshistorie auflösbar", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    const se = await sessionExerciseFor(r, s.id, "ex-chest-press");
    await logSet(r, se.id, 0, 40, 10);
    await r.sessions.complete(s.id);
    await r.devices.archive("dev-chest-press");
    const ses = await r.sessions.exercises(s.id);
    const device = await r.devices.get(ses[0].deviceId);
    expect(device?.name).toBe("Cybex Brustpresse");
    expect(ses[0].snapshot.deviceName).toBe("Cybex Brustpresse");
  });
});

describe("Trainingsvorlagen", () => {
  it("Positionen hinzufügen, umsortieren, bearbeiten, deaktivieren und entfernen", async () => {
    const r = await freshRepos();
    const ex = await r.exercises.create({ name: "Schrägbank", muscleGroup: "brust", deviceId: "dev-chest-press" });
    const slot = await r.templates.addSlot(TEMPLATE_A_ID, {
      exerciseId: ex.id,
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 10,
      restSeconds: 120,
    });
    let slots = await r.templates.slots(TEMPLATE_A_ID);
    expect(slots.at(-1)!.id).toBe(slot.id);
    await r.templates.moveSlot(slot.id, -1);
    slots = await r.templates.slots(TEMPLATE_A_ID);
    expect(slots.at(-2)!.id).toBe(slot.id);
    await r.templates.updateSlot(slot.id, { targetSets: 5, active: false });
    expect((await r.db.templateSlots.get(slot.id))!.targetSets).toBe(5);
    await r.templates.removeSlot(slot.id);
    slots = await r.templates.slots(TEMPLATE_A_ID);
    expect(slots).toHaveLength(9);
    expect(slots.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("verhindert Übungen fremder Muskelgruppen (verbindlicher Split)", async () => {
    const r = await freshRepos();
    await expect(
      r.templates.addSlot(TEMPLATE_B_ID, { exerciseId: "ex-chest-press", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }),
    ).rejects.toThrow();
  });

  it("Vorlagenänderungen verändern abgeschlossene Einheiten nicht", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    const se = await sessionExerciseFor(r, s.id, "ex-chest-press");
    await logSet(r, se.id, 0, 40, 10);
    await r.sessions.complete(s.id);
    const before = JSON.stringify({ ses: await r.sessions.exercises(s.id), sets: await r.sessions.sets(s.id) });

    const slots = await r.templates.slots(TEMPLATE_A_ID);
    await r.templates.updateSlot(slots[0].id, { targetSets: 6, targetRepsMin: 4, targetRepsMax: 6 });
    await r.templates.removeSlot(slots[1].id);
    await r.exercises.update("ex-chest-press", { name: "Umbenannt" });
    await r.devices.update("dev-chest-press", { name: "Neuer Name", muscleGroup: "brust", loadingType: "selectorized" });

    const after = JSON.stringify({ ses: await r.sessions.exercises(s.id), sets: await r.sessions.sets(s.id) });
    expect(after).toBe(before);
    expect((await r.sessions.exercises(s.id))[0].snapshot.exerciseName).toBe("Brustpressen");
  });
});

describe("Training durchführen", () => {
  it("Starten, Sätze erfassen, abschliessen – ohne Doppelabschluss", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    const ses = await r.sessions.exercises(s.id);
    expect(ses).toHaveLength(9);
    expect((await r.sessions.sets(s.id)).length).toBe(27); // 9 × 3 leere Satzzeilen
    await logSet(r, ses[0].id, 0, 42.5, 10);
    await logSet(r, ses[0].id, 1, 42.5, 9);

    await expect(r.sessions.start(TEMPLATE_B_ID)).rejects.toBeInstanceOf(ActiveSessionExistsError);

    expect(await r.sessions.complete(s.id)).toBe(true);
    expect(await r.sessions.complete(s.id)).toBe(false);
    expect(await r.sessions.abort(s.id)).toBe(false);
    const done = (await r.sessions.get(s.id))!;
    expect(done.status).toBe("completed");
    expect(done.endedAt).toBeTruthy();
    // Leere Satzzeilen wurden entfernt, erfasste bleiben.
    expect(await r.sessions.sets(s.id)).toHaveLength(2);
  });

  it("gleichzeitige Abschlüsse führen nur einmal zum Abschluss", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    const results = await Promise.all([r.sessions.complete(s.id), r.sessions.complete(s.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("laufendes Training wird nach erneutem Öffnen der Datenbank wiederhergestellt", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_B_ID);
    const se = (await r.sessions.exercises(s.id))[1];
    const set = (await r.db.sets.where("sessionExerciseId").equals(se.id).sortBy("index"))[0];
    await r.sessions.updateSet(set.id, { weightKg: 35, reps: 12 });
    await r.sessions.pause(s.id);
    r.db.close();

    const reopened = createRepositories(new FitnessDB(r.db.name));
    const active = await reopened.sessions.getActive();
    expect(active?.id).toBe(s.id);
    expect(active?.status).toBe("paused");
    const restored = await reopened.db.sets.get(set.id);
    expect(restored).toMatchObject({ weightKg: 35, reps: 12, completed: false });
    await reopened.sessions.resume(s.id);
    expect((await reopened.sessions.get(s.id))!.status).toBe("in_progress");
  });

  it("validiert Satzwerte", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    const set = (await r.sessions.sets(s.id))[0];
    await expect(r.sessions.updateSet(set.id, { weightKg: -5 })).rejects.toThrow();
    await expect(r.sessions.updateSet(set.id, { reps: 2.5 })).rejects.toThrow();
    await expect(r.sessions.updateSet(set.id, { completed: true })).rejects.toThrow();
  });

  it("vorherigen Satz übernehmen und Sätze hinzufügen/entfernen", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    const se = (await r.sessions.exercises(s.id))[0];
    await logSet(r, se.id, 0, 50, 10);
    const sets = await r.db.sets.where("sessionExerciseId").equals(se.id).sortBy("index");
    await r.sessions.copyPreviousSet(sets[1].id);
    expect(await r.db.sets.get(sets[1].id)).toMatchObject({ weightKg: 50, reps: 10, completed: false });
    const added = await r.sessions.addSet(se.id);
    expect(added.index).toBe(3);
    await r.sessions.removeSet(sets[0].id);
    const remaining = await r.db.sets.where("sessionExerciseId").equals(se.id).sortBy("index");
    expect(remaining.map((x) => x.index)).toEqual([0, 1, 2]);
  });

  it("Übung überspringen und Training abbrechen wird klar gekennzeichnet", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    const se = (await r.sessions.exercises(s.id))[0];
    await r.sessions.setExerciseStatus(se.id, "skipped");
    expect((await r.db.sessionExercises.get(se.id))!.status).toBe("skipped");
    await r.sessions.abort(s.id);
    expect((await r.sessions.get(s.id))!.status).toBe("aborted");
  });
});

describe("Letzte Werte", () => {
  it("zeigt die letzte abgeschlossene Durchführung, nicht abgebrochene", async () => {
    const r = await freshRepos();
    const s1 = await r.sessions.start(TEMPLATE_A_ID);
    await logSet(r, (await sessionExerciseFor(r, s1.id, "ex-row")).id, 0, 45, 10);
    await r.sessions.complete(s1.id);
    const s2 = await r.sessions.start(TEMPLATE_A_ID);
    await logSet(r, (await sessionExerciseFor(r, s2.id, "ex-row")).id, 0, 90, 10);
    await r.sessions.abort(s2.id);
    const s3 = await r.sessions.start(TEMPLATE_A_ID);
    const last = await r.sessions.lastPerformance("ex-row", "dev-row", s3.id);
    expect(last?.session.id).toBe(s1.id);
    expect(last?.sets[0].weightKg).toBe(45);
  });

  it("Bauchübung zeigt ihre letzten Werte unabhängig von Training A oder B", async () => {
    const r = await freshRepos();
    const a = await r.sessions.start(TEMPLATE_A_ID);
    await logSet(r, (await sessionExerciseFor(r, a.id, "ex-crunch")).id, 0, 30, 15);
    await r.sessions.complete(a.id);
    const b = await r.sessions.start(TEMPLATE_B_ID);
    const crunchB = await sessionExerciseFor(r, b.id, "ex-crunch");
    const lastInB = await r.sessions.lastPerformance(crunchB.exerciseId, crunchB.deviceId, b.id);
    expect(lastInB?.session.split).toBe("A");
    expect(lastInB?.sets[0].weightKg).toBe(30);
    await logSet(r, crunchB.id, 0, 35, 12);
    await r.sessions.complete(b.id);
    const a2 = await r.sessions.start(TEMPLATE_A_ID);
    const lastInA = await r.sessions.lastPerformance("ex-crunch", "dev-abdominal", a2.id);
    expect(lastInA?.session.split).toBe("B");
    expect(lastInA?.sets[0].weightKg).toBe(35);
  });

  it("letzte Werte als Vorschlag übernehmen – Sätze bleiben offen", async () => {
    const r = await freshRepos();
    const s1 = await r.sessions.start(TEMPLATE_A_ID);
    const se1 = await sessionExerciseFor(r, s1.id, "ex-lat-pulldown");
    for (let i = 0; i < 4; i++) await logSet(r, se1.id, i, 50 + i, 10);
    await r.sessions.complete(s1.id);
    const s2 = await r.sessions.start(TEMPLATE_A_ID);
    const se2 = await sessionExerciseFor(r, s2.id, "ex-lat-pulldown");
    expect(await r.sessions.applyLastValues(se2.id)).toBe(4);
    const sets = await r.db.sets.where("sessionExerciseId").equals(se2.id).sortBy("index");
    expect(sets.map((s) => s.weightKg)).toEqual([50, 51, 52, 53]);
    expect(sets.every((s) => !s.completed)).toBe(true);
    // Einheit abbrechen → Vorschläge erscheinen nicht als Leistung
    await r.sessions.abort(s2.id);
    expect((await r.sessions.lastPerformance("ex-lat-pulldown", "dev-lat-pulldown"))!.session.id).toBe(s1.id);
  });
});

describe("Butterfly / Reverse Butterfly", () => {
  it("führen getrennte Übungshistorien", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    await logSet(r, (await sessionExerciseFor(r, s.id, "ex-butterfly")).id, 0, 40, 12);
    await logSet(r, (await sessionExerciseFor(r, s.id, "ex-reverse-butterfly")).id, 0, 25, 15);
    await r.sessions.complete(s.id);
    const fly = await r.progress.seriesForExercise("ex-butterfly");
    const rev = await r.progress.seriesForExercise("ex-reverse-butterfly");
    expect(fly[0].points[0].topWeight).toBe(40);
    expect(rev[0].points[0].topWeight).toBe(25);
    expect(fly).toHaveLength(1);
    expect(rev).toHaveLength(1);
  });

  it("ein gemeinsames physisches Gerät kann beide Übungen bedienen – mit getrennten Einstellungen und Werten", async () => {
    const r = await freshRepos();
    await r.exercises.update("ex-reverse-butterfly", { deviceId: "dev-pec-fly" });
    await r.exercises.saveSetting("ex-butterfly", "dev-pec-fly", { seatHeight: "4", startPosition: "2" });
    await r.exercises.saveSetting("ex-reverse-butterfly", "dev-pec-fly", { seatHeight: "6", startPosition: "7" });
    const s = await r.sessions.start(TEMPLATE_A_ID);
    const fly = await sessionExerciseFor(r, s.id, "ex-butterfly");
    const rev = await sessionExerciseFor(r, s.id, "ex-reverse-butterfly");
    expect(fly.deviceId).toBe("dev-pec-fly");
    expect(rev.deviceId).toBe("dev-pec-fly");
    expect(fly.snapshot.settingsText).toContain("Sitzhöhe: 4");
    expect(rev.snapshot.settingsText).toContain("Sitzhöhe: 6");
    await logSet(r, fly.id, 0, 40, 12);
    await logSet(r, rev.id, 0, 20, 15);
    await r.sessions.complete(s.id);
    const s2 = await r.sessions.start(TEMPLATE_A_ID);
    expect((await r.sessions.lastPerformance("ex-butterfly", "dev-pec-fly", s2.id))!.sets[0].weightKg).toBe(40);
    expect((await r.sessions.lastPerformance("ex-reverse-butterfly", "dev-pec-fly", s2.id))!.sets[0].weightKg).toBe(20);
  });
});

describe("Beinpresse – Varianten", () => {
  it("beide Varianten sind auswählbar (vor dem Training)", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_B_ID, { slotChoices: { "slot-b-1": "ex-leg-press-plates" } });
    const first = (await r.sessions.exercises(s.id))[0];
    expect(first.exerciseId).toBe("ex-leg-press-plates");
    expect(first.deviceId).toBe("dev-leg-press-plates");
    expect(first.weightMode).toBe("plates_total");
    expect(first.alternativeExerciseIds).toEqual(["ex-leg-press-stack"]);
  });

  it("Wechsel einer leeren Position ersetzt Gerät und Eingabemodus", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_B_ID);
    const first = (await r.sessions.exercises(s.id))[0];
    expect(first.weightMode).toBe("block");
    const switched = await r.sessions.switchExercise(first.id, "ex-leg-press-plates", "replace");
    expect(switched.deviceId).toBe("dev-leg-press-plates");
    expect(switched.weightMode).toBe("plates_total");
    expect(switched.alternativeExerciseIds).toEqual(["ex-leg-press-stack"]);
    const sets = await r.db.sets.where("sessionExerciseId").equals(first.id).toArray();
    expect(sets.every((x) => x.deviceId === "dev-leg-press-plates" && x.weightBasis.mode === "plates_total")).toBe(true);
  });

  it("Variantenwechsel verändert keine bereits gespeicherten Sätze", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_B_ID);
    const first = (await r.sessions.exercises(s.id))[0];
    const logged = await logSet(r, first.id, 0, 100, 10);
    await expect(r.sessions.switchExercise(first.id, "ex-leg-press-plates", "replace")).rejects.toBeInstanceOf(
      SetsWouldBeLostError,
    );
    const added = await r.sessions.switchExercise(first.id, "ex-leg-press-plates", "add");
    expect(added.order).toBe(1);
    const original = await r.db.sets.get(logged.id);
    expect(original).toMatchObject({ exerciseId: "ex-leg-press-stack", deviceId: "dev-leg-press-stack", weightKg: 100 });
    expect((await r.db.sessionExercises.get(first.id))!.exerciseId).toBe("ex-leg-press-stack");
  });

  it("Gewichtsblock- und Scheibenwerte werden nicht vermischt", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_B_ID);
    const stack = (await r.sessions.exercises(s.id))[0];
    await logSet(r, stack.id, 0, 100, 10);
    const plates = await r.sessions.switchExercise(stack.id, "ex-leg-press-plates", "add");
    const pSet = (await r.db.sets.where("sessionExerciseId").equals(plates.id).sortBy("index"))[0];
    const load = { symmetric: true, left: [{ kg: 20, count: 2 }], right: [] };
    const total = totalPlateWeight(load);
    await r.sessions.updateSet(pSet.id, {
      weightKg: total,
      reps: 12,
      completed: true,
      weightBasis: { mode: "plates_calc", platesKg: total, ...load, includesStartWeight: false },
    });
    await r.sessions.complete(s.id);

    const stackSeries = await r.progress.seriesForExercise("ex-leg-press-stack");
    const plateSeries = await r.progress.seriesForExercise("ex-leg-press-plates");
    expect(stackSeries).toHaveLength(1);
    expect(plateSeries).toHaveLength(1);
    expect(stackSeries[0].points[0].topWeight).toBe(100);
    expect(plateSeries[0].points[0].topWeight).toBe(80);
    expect(plateSeries[0].key.basisKey).toBe("plates");

    const s2 = await r.sessions.start(TEMPLATE_B_ID);
    expect((await r.sessions.lastPerformance("ex-leg-press-stack", "dev-leg-press-stack", s2.id))!.sets[0].weightKg).toBe(100);
    expect((await r.sessions.lastPerformance("ex-leg-press-plates", "dev-leg-press-plates", s2.id))!.sets[0].weightKg).toBe(80);
  });

  it("Startgewicht ändert historische Sätze nicht und bildet eine eigene Vergleichsreihe", async () => {
    const r = await freshRepos();
    const s1 = await r.sessions.start(TEMPLATE_B_ID, { slotChoices: { "slot-b-1": "ex-leg-press-plates" } });
    const se1 = (await r.sessions.exercises(s1.id))[0];
    const set1 = (await r.db.sets.where("sessionExerciseId").equals(se1.id).sortBy("index"))[0];
    await r.sessions.updateSet(set1.id, {
      weightKg: 80,
      reps: 10,
      completed: true,
      weightBasis: { mode: "plates_total", platesKg: 80, includesStartWeight: false },
    });
    await r.sessions.complete(s1.id);

    const dev = (await r.devices.get("dev-leg-press-plates"))!;
    await r.devices.update(dev.id, { ...dev, startWeightKg: 40, includeStartWeight: true });
    const s2 = await r.sessions.start(TEMPLATE_B_ID, { slotChoices: { "slot-b-1": "ex-leg-press-plates" } });
    const se2 = (await r.sessions.exercises(s2.id))[0];
    const set2 = (await r.db.sets.where("sessionExerciseId").equals(se2.id).sortBy("index"))[0];
    expect(set2.weightBasis).toMatchObject({ includesStartWeight: true, startWeightKg: 40 });
    await r.sessions.updateSet(set2.id, {
      weightKg: 120,
      reps: 10,
      completed: true,
      weightBasis: { mode: "plates_total", platesKg: 80, includesStartWeight: true, startWeightKg: 40 },
    });
    await r.sessions.complete(s2.id);

    expect((await r.db.sets.get(set1.id))!.weightKg).toBe(80);
    const series = await r.progress.seriesForExercise("ex-leg-press-plates");
    expect(series.map((x) => x.key.basisKey).sort()).toEqual(["plates", "plates+start:40"]);
  });
});

describe("Volumen aus gespeicherten Sätzen", () => {
  it("Aufwärmsätze sind standardmässig ausgeschlossen", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    const se = await sessionExerciseFor(r, s.id, "ex-chest-press");
    await logSet(r, se.id, 0, 20, 15, { isWarmup: true });
    await logSet(r, se.id, 1, 50, 10);
    await logSet(r, se.id, 2, 50, 8);
    await r.sessions.complete(s.id);
    const sets = await r.sessions.sets(s.id);
    expect(computeVolume(sets)).toBe(900);
    const [series] = await r.progress.seriesForExercise("ex-chest-press");
    expect(series.points[0].volume).toBe(900);
    const [withWarmup] = await r.progress.seriesForExercise("ex-chest-press", { includeWarmup: true });
    expect(withWarmup.points[0].volume).toBe(1200);
  });
});

describe("Backup", () => {
  it("Export und erneuter Import stellen alle Daten inkl. Bilder wieder her", async () => {
    const r = await freshRepos();
    await r.devices.setUploadedImage("dev-row", new Uint8Array([1, 2, 3, 250]).buffer, "image/png");
    const s = await r.sessions.start(TEMPLATE_A_ID);
    await logSet(r, (await sessionExerciseFor(r, s.id, "ex-row")).id, 0, 45.5, 10);
    await r.sessions.complete(s.id);
    const json = await r.backup.exportBackupJson();

    const target = await freshRepos();
    const parsed = target.backup.parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await target.backup.importBackup(parsed.backup);

    expect(await target.db.sessions.count()).toBe(1);
    const sets = await target.sessions.sets(s.id);
    expect(sets.find((x) => x.completed)!.weightKg).toBe(45.5);
    const device = (await target.devices.get("dev-row"))!;
    expect(device.image.kind).toBe("upload");
    const img = await target.devices.getImage((device.image as { blobId: string }).blobId);
    expect([...new Uint8Array(img!.data)]).toEqual([1, 2, 3, 250]);
  });

  it("Import mit ungültigem Schema wird abgelehnt", async () => {
    const r = await freshRepos();
    expect(r.backup.parseBackup("kein json").ok).toBe(false);
    expect(r.backup.parseBackup(JSON.stringify({ app: "x" })).ok).toBe(false);
    const backup = await r.backup.exportBackup();
    const broken = structuredClone(backup);
    broken.data.sets.push({ ...(broken.data.sets[0] ?? {}), id: "x", sessionExerciseId: "fehlt", reps: -3 } as never);
    expect(r.backup.parseBackup(JSON.stringify(broken)).ok).toBe(false);
  });

  it("CSV enthält eine Zeile pro Satz", async () => {
    const r = await freshRepos();
    const s = await r.sessions.start(TEMPLATE_A_ID);
    await logSet(r, (await sessionExerciseFor(r, s.id, "ex-row")).id, 0, 45.5, 10);
    await r.sessions.complete(s.id);
    const csv = await r.backup.exportCsv();
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Gewicht (kg)");
    expect(lines[1]).toContain("Rudern");
    expect(lines[1]).toContain("45.5");
  });
});

describe("Schultern (Migration bestehender Installationen)", () => {
  async function simulateOldInstall() {
    const r = await freshRepos();
    // Zustand vor der Erweiterung herstellen
    const slot = (await r.templates.slots(TEMPLATE_A_ID)).find((x) => x.exerciseId === "ex-shoulder-press")!;
    await r.templates.removeSlot(slot.id);
    await r.db.exercises.delete("ex-shoulder-press");
    await r.db.devices.delete("dev-shoulder-press");
    await r.db.templates.update(TEMPLATE_A_ID, {
      allowedMuscleGroups: ["brust", "ruecken", "bizeps", "trizeps", "bauch"],
      description: "Brust, Rücken, Bizeps, Trizeps, Bauch",
    });
    await r.db.meta.delete(MIGRATION_SHOULDERS);
    return r;
  }

  it("ergänzt Gerät, Übung, Muskelgruppe und Position hinter Reverse Butterfly genau einmal", async () => {
    const r = await simulateOldInstall();
    await r.devices.update("dev-chest-press", { name: "Meine Brustpresse", muscleGroup: "brust", loadingType: "selectorized" });
    await ensureSeeded(r.db);
    expect((await r.devices.get("dev-shoulder-press"))?.muscleGroup).toBe("schultern");
    expect((await r.templates.get(TEMPLATE_A_ID))!.allowedMuscleGroups).toContain("schultern");
    const ids = (await r.templates.slots(TEMPLATE_A_ID)).map((x) => x.exerciseId);
    expect(ids.indexOf("ex-shoulder-press")).toBe(ids.indexOf("ex-reverse-butterfly") + 1);
    expect((await r.templates.slots(TEMPLATE_A_ID)).map((x) => x.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    // Nutzeränderungen bleiben erhalten
    expect((await r.devices.get("dev-chest-press"))!.name).toBe("Meine Brustpresse");
    await ensureSeeded(r.db);
    expect((await r.templates.slots(TEMPLATE_A_ID)).filter((x) => x.exerciseId === "ex-shoulder-press")).toHaveLength(1);
  });

  it("vom Nutzer entfernte Schulterpresse wird nicht erneut eingefügt", async () => {
    const r = await freshRepos();
    const slot = (await r.templates.slots(TEMPLATE_A_ID)).find((x) => x.exerciseId === "ex-shoulder-press")!;
    await r.templates.removeSlot(slot.id);
    await ensureSeeded(r.db);
    expect((await r.templates.slots(TEMPLATE_A_ID)).some((x) => x.exerciseId === "ex-shoulder-press")).toBe(false);
  });

  it("Schulterpresse ist in Training B nicht zulässig", async () => {
    const r = await freshRepos();
    await expect(
      r.templates.addSlot(TEMPLATE_B_ID, { exerciseId: "ex-shoulder-press", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }),
    ).rejects.toThrow();
  });
});
