import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Verkleinert ein Bild clientseitig (max. Kantenlänge), um Speicher zu sparen. */
export async function resizeImage(
  file: File,
  maxEdge = 1600,
): Promise<{ data: ArrayBuffer; mimeType: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Bitte eine Bilddatei auswählen.");
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) {
      return { data: await file.arrayBuffer(), mimeType: file.type };
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) throw new Error("Bild konnte nicht verarbeitet werden.");
    return { data: await blob.arrayBuffer(), mimeType: "image/jpeg" };
  } catch {
    // Fallback: Originaldatei speichern (z. B. wenn createImageBitmap das Format nicht kennt)
    return { data: await file.arrayBuffer(), mimeType: file.type };
  }
}
