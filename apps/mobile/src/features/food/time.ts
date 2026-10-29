/**
 * Time-of-day helpers for the timeline Log. Entries carry `time: "HH:MM"` (24h, local) instead
 * of a meal; ported from design-reference/log/timeline-utils.jsx.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "HH:MM" → minutes since midnight. */
export const toMin = (t: string) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Minutes since midnight → "HH:MM", wrapping around the day. */
export const fromMin = (m: number) => {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
};

/** "HH:MM" of an ISO timestamp, in the device's timezone. */
export const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * `date` (YYYY-MM-DD) at `time` (HH:MM), as ISO 8601 with the device's UTC offset — e.g.
 * "2026-10-14T08:10:00+03:00". The offset matters: the server files the entry under the day
 * and meal of this local time, so 00:30 here must not become the previous day in UTC.
 */
export function toLoggedAt(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const local = new Date(y, mo - 1, d, h, mi);
  const offset = -local.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${date}T${pad(h)}:${pad(mi)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export const byTime = <T extends { time: string; uid: number }>(a: T, b: T) =>
  toMin(a.time) - toMin(b.time) || a.uid - b.uid;
