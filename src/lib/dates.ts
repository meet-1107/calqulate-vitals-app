export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY = 86_400_000;

export const dayKey = (t: number | Date = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

export const isSameDay = (a: number, b: number) => dayKey(a) === dayKey(b);

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function greeting(at = new Date()) {
  const h = at.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export function formatHour(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${suffix}`;
}

/** Next occurrence of `weekday` at `hour`, relative to `from`. */
export function nextInjection(weekday: number | null, hour: number, from = Date.now()) {
  if (weekday == null) return null;
  const d = new Date(from);
  const delta = (weekday - d.getDay() + 7) % 7;
  const next = new Date(d);
  next.setDate(d.getDate() + delta);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= from) next.setDate(next.getDate() + 7);
  return next;
}

export function relativeDay(date: Date, from = Date.now()) {
  const diff = Math.round((startOfDay(date.getTime()) - startOfDay(from)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return DAY_LABELS[date.getDay()];
}
