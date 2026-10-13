import type { Device, DeviceImageBlob, LoadingType, MuscleGroup } from "@/domain/types";
import { type FitnessDB, newId, nowIso } from "../db";

export interface DeviceInput {
  name: string;
  model?: string;
  series?: string;
  muscleGroup: MuscleGroup;
  description?: string;
  loadingType: LoadingType;
  weightIncrementKg?: number;
  weightStepsNote?: string;
  availablePlatesKg?: number[];
  startWeightKg?: number;
  includeStartWeight?: boolean;
}

const clean = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : undefined;
};

function validate(input: DeviceInput) {
  if (!input.name.trim()) throw new Error("Gerätename darf nicht leer sein.");
  for (const v of [input.weightIncrementKg, input.startWeightKg]) {
    if (v !== undefined && (!Number.isFinite(v) || v < 0)) {
      throw new Error("Gewichtswerte dürfen nicht negativ sein.");
    }
  }
  if (input.availablePlatesKg?.some((p) => !Number.isFinite(p) || p <= 0)) {
    throw new Error("Scheibengrössen müssen positive Zahlen sein.");
  }
}

export function createDevicesRepository(db: FitnessDB) {
  return {
    async list(options: { includeArchived?: boolean } = {}): Promise<Device[]> {
      const all = await db.devices.toArray();
      return all
        .filter((d) => options.includeArchived || !d.archivedAt)
        .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
    },

    get(id: string) {
      return db.devices.get(id);
    },

    async create(input: DeviceInput): Promise<Device> {
      validate(input);
      const now = nowIso();
      const device: Device = {
        id: newId(),
        brand: "Cybex",
        name: input.name.trim(),
        model: clean(input.model),
        series: clean(input.series),
        muscleGroup: input.muscleGroup,
        description: clean(input.description),
        loadingType: input.loadingType,
        weightIncrementKg: input.weightIncrementKg,
        weightStepsNote: clean(input.weightStepsNote),
        availablePlatesKg: input.availablePlatesKg,
        startWeightKg: input.startWeightKg,
        includeStartWeight: input.startWeightKg !== undefined ? !!input.includeStartWeight : false,
        image: { kind: "illustration" },
        illustrationKey: input.loadingType === "plate_loaded" ? "generic-plates" : "generic-stack",
        isSeed: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.devices.add(device);
      return device;
    },

    async update(id: string, input: DeviceInput): Promise<void> {
      validate(input);
      const existing = await db.devices.get(id);
      if (!existing) throw new Error("Gerät nicht gefunden.");
      await db.devices.put({
        ...existing,
        name: input.name.trim(),
        model: clean(input.model),
        series: clean(input.series),
        muscleGroup: input.muscleGroup,
        description: clean(input.description),
        loadingType: input.loadingType,
        weightIncrementKg: input.weightIncrementKg,
        weightStepsNote: clean(input.weightStepsNote),
        availablePlatesKg: input.availablePlatesKg,
        startWeightKg: input.startWeightKg,
        includeStartWeight: input.startWeightKg !== undefined ? !!input.includeStartWeight : false,
        updatedAt: nowIso(),
      });
    },

    /** Archivieren statt Löschen: Historie bleibt vollständig darstellbar. */
    async archive(id: string) {
      await db.devices.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
    },

    async unarchive(id: string) {
      const d = await db.devices.get(id);
      if (!d) return;
      const { archivedAt: _ignored, ...rest } = d;
      void _ignored;
      await db.devices.put({ ...rest, updatedAt: nowIso() });
    },

    async setUploadedImage(id: string, data: ArrayBuffer, mimeType: string, fileName?: string) {
      await db.transaction("rw", db.devices, db.deviceImages, async () => {
        const device = await db.devices.get(id);
        if (!device) throw new Error("Gerät nicht gefunden.");
        const blobId = newId();
        const blob: DeviceImageBlob = { id: blobId, mimeType, data, createdAt: nowIso() };
        await db.deviceImages.add(blob);
        if (device.image.kind === "upload") await db.deviceImages.delete(device.image.blobId);
        await db.devices.update(id, {
          image: { kind: "upload", blobId, fileName },
          updatedAt: nowIso(),
        });
      });
    },

    async setImageUrl(id: string, url: string, source: string, license?: string) {
      if (!/^https?:\/\//i.test(url.trim())) throw new Error("Bitte eine gültige http(s)-URL angeben.");
      if (!source.trim()) throw new Error("Bitte die Bildquelle angeben.");
      await db.transaction("rw", db.devices, db.deviceImages, async () => {
        const device = await db.devices.get(id);
        if (!device) throw new Error("Gerät nicht gefunden.");
        if (device.image.kind === "upload") await db.deviceImages.delete(device.image.blobId);
        await db.devices.update(id, {
          image: { kind: "url", url: url.trim(), source: source.trim(), license: clean(license) },
          updatedAt: nowIso(),
        });
      });
    },

    async resetImage(id: string) {
      await db.transaction("rw", db.devices, db.deviceImages, async () => {
        const device = await db.devices.get(id);
        if (!device) return;
        if (device.image.kind === "upload") await db.deviceImages.delete(device.image.blobId);
        await db.devices.update(id, { image: { kind: "illustration" }, updatedAt: nowIso() });
      });
    },

    getImage(blobId: string) {
      return db.deviceImages.get(blobId);
    },
  };
}

export type DevicesRepository = ReturnType<typeof createDevicesRepository>;
