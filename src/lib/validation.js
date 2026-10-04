// Technical validity only; these checks do not extend clinical applicability.
export const MAX_SIM_MINUTES = 1440;
export function finite(value, name, {
  min = 0,
  positive = false
} = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || positive && value <= 0) throw new RangeError(`Invalid ${name}`);
  return value;
}
export function validatePatient(p) {
  if (!p || typeof p !== 'object') throw new TypeError('Invalid patient');
  finite(p.age, 'age');
  finite(p.weight, 'weight', {
    positive: true
  });
  finite(p.height, 'height', {
    positive: true
  });
  if (!['male', 'female'].includes(p.gender)) throw new RangeError('Invalid sex');
  return p;
}
export function validateParams(p) {
  for (const k of ['V1', 'V2', 'V3', 'Cl', 'Q2', 'Q3', 'ke0']) finite(p?.[k], k, {
    positive: k === 'V1'
  });
  if (!p.V2 && p.Q2 || !p.V3 && p.Q3) throw new RangeError('Exchange requires a compartment volume');
  return p;
}
export function validateDuration(d) {
  finite(d, 'simulation duration', {
    positive: true
  });
  if (d > MAX_SIM_MINUTES) throw new RangeError('Simulation window exceeds 24 hours');
}
export function validateEvent(e) {
  if (!e || !['bolus', 'infusion'].includes(e.type) || e.id == null) throw new TypeError('Invalid event');
  if ((typeof e.id !== 'string' && typeof e.id !== 'number') || (typeof e.id === 'number' && !Number.isFinite(e.id)) || e.id === '') throw new TypeError('Invalid event ID');
  if (e.entryStatus != null && !['administered','planned'].includes(e.entryStatus)) throw new TypeError('Invalid entry status');
  if (e.seriesLabel != null && (typeof e.seriesLabel !== 'string' || e.seriesLabel.length > 100)) throw new TypeError('Invalid pump label');
  finite(e.time, 'event time', {
    min: -MAX_SIM_MINUTES
  });
  if (e.time > MAX_SIM_MINUTES) throw new RangeError('Event time exceeds 24 hours');
  if (e.type === 'bolus') finite(e.amount, 'dose', {
    positive: true
  });else {
    finite(e.rate, 'infusion rate');
    if (e.seriesId != null && (typeof e.seriesId !== 'string' || !e.seriesId)) throw new TypeError('Invalid infusion series');
    if (e.seriesLimit != null) {
      if (typeof e.seriesLimit.isInfinite !== 'boolean') throw new TypeError('Invalid series stop');
      if (!e.seriesLimit.isInfinite) validateDuration(e.seriesLimit.duration);
    }
    if (e.isInfinite !== true) {
      finite(e.duration, 'infusion duration', {
        positive: true
      });
      if (e.duration > MAX_SIM_MINUTES) throw new RangeError('Infusion duration exceeds 24 hours');
    }
  }
  return e;
}
export function isValidPatient(p) {
  try {
    validatePatient(p);
    return true;
  } catch {
    return false;
  }
}
export function positiveInput(v) {
  return v !== '' && Number.isFinite(Number(v)) && Number(v) > 0;
}
export function newEventId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++eventSequence}`;
}
let eventSequence = 0;
