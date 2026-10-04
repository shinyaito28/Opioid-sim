import { validateEvent } from './validation.js';
import { replaceEvent } from './state.js';

// Only explicitly identified rate-change series may alter other records.
// Preserve the entered stop separately from a boundary caused by the next change.
function normalizeSeries(events, drug, seriesId) {
  const member = e => e.type === 'infusion' && e.drug === drug && !e.parallel && e.seriesId === seriesId;
  const series = events.filter(member).sort((a, b) => a.time - b.time);
  const normalized = series.map((e, i) => {
    const limit = e.seriesLimit || { duration: e.duration, isInfinite: e.isInfinite === true };
    const entered = { ...e, duration: limit.duration, isInfinite: limit.isInfinite, seriesLimit: { ...limit } };
    validateEvent(entered);
    const next = series[i + 1];
    if (!next || !entered.isInfinite && entered.time + entered.duration <= next.time) return entered;
    return { ...entered, isInfinite: false, duration: next.time - entered.time };
  });
  normalized.forEach(validateEvent);
  const byId = new Map(normalized.map(e => [e.id,e]));
  return events.map(e => byId.get(e.id) || e);
}

export function scheduleEvent(events, event, rateChange = false) {
  validateEvent(event);
  const old = events.find(e => e.id === event.id);
  const finish = result => old?.type === 'infusion' && old.seriesId && !old.parallel
    ? normalizeSeries(result, old.drug, old.seriesId) : result;
  if (event.type !== 'infusion' || !rateChange || event.parallel) return finish(replaceEvent(events, event));
  // No UI selection currently establishes which legacy pump should change.
  // Reject an ambiguous new operation without modifying any saved record.
  const end = event.isInfinite ? Infinity : event.time + event.duration;
  const ambiguous = !event.seriesId && events.some(e => e.id !== event.id && e.drug === event.drug &&
    e.type === 'infusion' && !e.parallel && !e.seriesId &&
    event.time < (e.isInfinite ? Infinity : e.time + e.duration) && e.time < end);
  if (ambiguous) {
    const error = new RangeError('An infusion series must be selected');
    error.code = 'AMBIGUOUS_INFUSION';
    throw error;
  }
  const seriesId = event.seriesId || `default:${event.drug}`;
  const keep = events.filter(e => e.id !== event.id && !(e.type === 'infusion' && e.drug === event.drug &&
    !e.parallel && e.seriesId === seriesId && e.time === event.time));
  return finish(normalizeSeries([...keep, { ...event, seriesId }], event.drug, seriesId));
}

export function preserveEnteredStop(old, event) {
  const result = { ...event };
  if (old?.drug !== event.drug || old?.type !== event.type) {
    delete result.seriesId; delete result.seriesLimit;
  } else if (old?.isInfinite !== event.isInfinite || old?.duration !== event.duration) {
    delete result.seriesLimit;
  }
  return result;
}

export function removeScheduledEvent(events, id) {
  const old = events.find(e => e.id === id);
  const remaining = events.filter(e => e.id !== id);
  return old?.type === 'infusion' && old.seriesId && !old.parallel
    ? normalizeSeries(remaining, old.drug, old.seriesId) : remaining;
}
