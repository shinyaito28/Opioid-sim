import { AVAILABLE_MODELS, DRUG_UNITS } from './drugs.js';
import { validatePatient, validateDuration, validateEvent, finite } from './validation.js';
export const CALCULATION_VERSION = 'rk4-bae-table2-v1';
export function validateSnapshot(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Invalid saved state');
  const d = structuredClone(input);
  validatePatient(d.patient);
  validateDuration(d.simDuration);
  if (d.entryReferenceTime != null) { finite(d.entryReferenceTime,'entry reference'); if (d.entryReferenceTime > 1440) throw new RangeError('Invalid entry reference'); }
  if (d.includePlanned != null && typeof d.includePlanned !== 'boolean') throw new TypeError('Invalid calculation scope');
  if (d.schemaVersion != null && (!Number.isInteger(d.schemaVersion) || d.schemaVersion < 1 || d.schemaVersion > 4)) throw new RangeError('Unsupported saved state');
  if (!DRUG_UNITS[d.drug]) throw new RangeError('Unknown saved drug');
  d.modelByDrug = d.modelByDrug ?? (d.model ? {
    [d.drug]: d.model
  } : {});
  for (const [drug, model] of Object.entries(d.modelByDrug)) if (!AVAILABLE_MODELS[drug]?.includes(model)) throw new RangeError('Invalid saved model');
  if (!Array.isArray(d.events)) throw new TypeError('Invalid saved events');
  const ids = new Set();
  d.events = d.events.map(e => {
    e.drug = e.drug || d.drug;
    if (!DRUG_UNITS[e.drug]) throw new RangeError('Unknown event drug');
    validateEvent(e);
    if (ids.has(e.id)) throw new RangeError('Duplicate event ID');
    ids.add(e.id);
    return e;
  });
  d.autoFillStats = typeof d.autoFillStats === 'boolean' ? d.autoFillStats : false;
  d.therapeuticOverrides = d.therapeuticOverrides ?? {};
  for (const [drug, r] of Object.entries(d.therapeuticOverrides)) {
    if (!DRUG_UNITS[drug]) throw new RangeError('Invalid range drug');
    finite(r.analgesiaMin, 'lower threshold');
    finite(r.analgesiaMax, 'upper threshold');
    if (r.analgesiaMin > r.analgesiaMax) throw new RangeError('Reversed range');
  }
  const start = d.simSettings?.startTime ?? d.startTime;
  if (start && !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) throw new RangeError('Invalid saved clock');
  const date = d.simSettings?.clockStartDate ?? d.clockStartDate;
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(`${date}T12:00:00`).getTime()) || new Date(`${date}T12:00:00`).getDate() !== Number(date.slice(-2)))) throw new RangeError('Invalid saved date');
  for (const key of ['savedTraces', 'savedScenarios']) if (d[key] != null && (!Array.isArray(d[key]) || d[key].some(v => !v || typeof v !== 'object'))) throw new TypeError('Invalid saved list');
  for (const trace of d.savedTraces ?? []) {
    if (trace.id == null || typeof trace.name !== 'string' || typeof trace.color !== 'string' || !Array.isArray(trace.data) || !DRUG_UNITS[trace.drug]) throw new TypeError('Invalid saved trace');
  }
  for (const scenario of d.savedScenarios ?? []) {
    if (scenario.id == null || typeof scenario.name !== 'string' || !scenario.data || typeof scenario.data !== 'object') throw new TypeError('Invalid saved scenario');
  }
  if (!d.therapeuticOverrides || typeof d.therapeuticOverrides !== 'object' || Array.isArray(d.therapeuticOverrides)) throw new TypeError('Invalid ranges');
  if (d.modelByDrug == null || typeof d.modelByDrug !== 'object' || Array.isArray(d.modelByDrug)) throw new TypeError('Invalid model map');
  if (d.isClockMode != null && typeof d.isClockMode !== 'boolean') throw new TypeError('Invalid clock mode');
  if (d.lastDoseByDrug != null && (typeof d.lastDoseByDrug !== 'object' || Array.isArray(d.lastDoseByDrug))) throw new TypeError('Invalid last dose map');
  for (const [drug, last] of Object.entries(d.lastDoseByDrug ?? {})) {
    if (!DRUG_UNITS[drug] || !last || typeof last !== 'object') throw new TypeError('Invalid dose entry');
    for (const key of ['bolusAmount', 'infusionRate', 'infusionDuration']) if (last[key] != null) finite(last[key], key);
    if (last.infusionUnit != null && !DRUG_UNITS[drug].includes(last.infusionUnit)) throw new RangeError('Invalid saved unit');
  }
  return d;
}
// Non-destructive update: an edit replaces exactly one ID; parallel IDs survive.
export function replaceEvent(events, event) {
  validateEvent(event);
  return events.some(e => e.id === event.id) ? events.map(e => e.id === event.id ? event : e) : [...events, event];
}
