export function durationAbove(data, threshold, key = 'ce', consecutive = false) {
  if (!Number.isFinite(threshold)) return null;
  let total = 0,
    run = 0,
    longest = 0;
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1],
      b = data[i];
    if (a[key] == null || b[key] == null) {
      run = 0;
      continue;
    }
    const dt = b.time - a.time;
    let fraction = 0;
    if (a[key] >= threshold && b[key] >= threshold) fraction = 1;else if (a[key] >= threshold !== b[key] >= threshold) fraction = (Math.max(a[key], b[key]) - threshold) / Math.abs(b[key] - a[key]);
    const span = dt * fraction;
    total += span;
    if (a[key] < threshold) run = 0;
    run += span;
    longest = Math.max(longest, run);
    if (b[key] < threshold) run = 0;
  }
  return consecutive ? longest : total;
}
export function summarize(data, events, drug, duration, range, display, doseUnit) {
  const hasCe = data.some(p => p.ce != null),
    peak = k => data.reduce((best, p) => p[k] != null && p[k] > best.value ? {
      value: p[k],
      time: p.time
    } : best, {
      value: 0,
      time: 0
    });
  const lower = hasCe ? range?.analgesiaMin ?? range?.bisTarget?.min : null,
    upper = hasCe ? range?.respiratoryRisk ?? range?.bisTarget?.max : null;
  const relevant = events.filter(e => e.drug === drug);
  const totalDose = relevant.reduce((sum, e) => sum + (e.type === 'bolus' ? e.time >= 0 && e.time <= duration ? e.amount : 0 : e.rate * Math.max(0, Math.min(duration, e.isInfinite ? duration : e.time + e.duration) - Math.max(0, e.time)) / 60), 0);
  const stops = relevant.filter(e => e.type === 'infusion' && e.rate > 0 && !e.isInfinite && e.time + e.duration <= duration),
    lastStop = stops.length ? Math.max(...stops.map(e => e.time + e.duration)) : null;
  const stillRunning = relevant.some(e => e.type === 'infusion' && e.rate > 0 && e.time <= duration && (e.isInfinite || e.time + e.duration > duration));
  const recovery = lower != null && lastStop != null && !stillRunning ? data.find(p => p.time >= lastStop && p.ce < lower) : null;
  return {
    hasCe,
    peakCe: hasCe ? peak('ce') : peak('cp'),
    peakCp: peak('cp'),
    onsetTime: lower != null ? data.find(p => p.ce >= lower)?.time ?? null : null,
    respRiskMin: durationAbove(data, upper),
    totalDose,
    recoveryTime: recovery ? recovery.time - lastStop : null,
    isSedative: !!range?.bisTarget,
    onsetThreshold: lower != null ? lower / display.divisor : null,
    respRiskThreshold: upper != null ? upper / display.divisor : null,
    displayUnit: display.unit,
    displayDivisor: display.divisor,
    drugUnit: doseUnit
  };
}
