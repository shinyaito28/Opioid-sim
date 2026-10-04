export function clockToMinutes(value, start, reference = 0) {
  const parse = s => {
    if (!/^\d{2}:\d{2}$/.test(s)) throw new RangeError('Invalid clock time');
    const [h, m] = s.split(':').map(Number);
    if (h > 23 || m > 59) throw new RangeError('Invalid clock time');
    return h * 60 + m;
  };
  const raw = parse(value) - parse(start);
  return raw + 1440 * Math.round((reference - raw) / 1440);
}
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function elapsedMinutes(now, date, start) {
  const anchor = new Date(`${date}T${start}:00`);
  if (!Number.isFinite(anchor.getTime())) throw new RangeError('Invalid clock date');
  return Math.floor((now - anchor) / 60000);
}
