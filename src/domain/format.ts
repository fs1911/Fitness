const pad = (n: number) => String(n).padStart(2, "0");

/** TT.MM.JJJJ */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** HH:mm (24 h) */
export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(iso: string | Date): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export function formatWeekday(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return WEEKDAYS[d.getDay()];
}

const numberFormat = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 });
const integerFormat = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });

/** Zahl im Schweizer Format (Tausendertrennzeichen ’). */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return `${numberFormat.format(value)} kg`;
}

export function formatVolume(value: number): string {
  return `${integerFormat.format(Math.round(value))} kg`;
}

/** Eingabewert für Gewichtsfelder: Komma als Dezimaltrennzeichen ist erlaubt; wir zeigen Punkt nach CH-Norm. */
export function weightToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Dauer in ms → „1 h 05 min“ bzw. „42 min“. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "–";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${pad(m)} min`;
}

/** Stoppuhr-Darstellung mm:ss bzw. h:mm:ss. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Datum als yyyy-mm-dd für <input type="date"> (lokale Zeit). */
export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Montag 00:00 der aktuellen Woche (lokale Zeit). */
export function startOfWeek(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mo = 0
  d.setDate(d.getDate() - day);
  return d;
}
