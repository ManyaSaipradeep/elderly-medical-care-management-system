// India has no daylight saving, so a fixed +05:30 offset is exact for Asia/Kolkata.
export const TZ = 'Asia/Kolkata';
const OFFSET = '+05:30';

export const SLOTS = ['morning', 'afternoon', 'night'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, string> = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' };

/** YYYY-MM-DD in India for a given instant */
export const localDate = (d: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
export const atLocal = (date: string, hhmm: string) => new Date(`${date}T${hhmm.slice(0, 5)}:00${OFFSET}`);
export const addDays = (date: string, n: number) => localDate(new Date(atLocal(date, '12:00').getTime() + n * 86400000));
export const startOfLocalDay = (date: string) => atLocal(date, '00:00');

export const fmtTime = (d: Date | string) =>
  new Date(d).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDateTime = (d: Date | string) => `${fmtDate(d)}, ${fmtTime(d)}`;
export const fmtHHMM = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export function greeting(d: Date = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
