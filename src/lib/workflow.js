import { validateEvent, finite, newEventId } from './validation.js';
import { scheduleEvent, removeScheduledEvent } from './schedule.js';

export const MAIN_DRUGS = ['Fentanyl', 'Hydromorphone', 'Morphine', 'Propofol', 'Remimazolam'];
export const eventStatus = event => event.entryStatus || 'unclassified';
export const infusionKey = event => event.seriesId && !event.parallel
  ? `${event.drug}:${event.seriesId}` : `legacy:${event.id}`;

export function infusionGroups(events) {
  const groups = new Map();
  for (const event of events.filter(e => e.type === 'infusion')) {
    const key = infusionKey(event);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  return [...groups.entries()].map(([key, records], index) => {
    const sorted = [...records].sort((a, b) => a.time - b.time);
    return { key, records: sorted, first: sorted[0], label: sorted[0].seriesLabel || `L${index + 1}` };
  });
}

function nextPumpLabel(events, drug) {
  const numbers = infusionGroups(events).filter(g => g.first.drug === drug)
    .map(g => Number(/^#(\d+)$/.exec(g.label)?.[1] || 0));
  return `#${Math.max(0, ...numbers) + 1}`;
}

export function activeInfusion(group, minute) {
  return group.records.filter(e => e.time <= minute && (e.isInfinite || minute < e.time + e.duration)).at(-1) || null;
}

export function classifyEntry(event, status, reference) {
  finite(reference, 'entry reference', { min: -1440 });
  if (!['administered', 'planned'].includes(status)) throw new RangeError('Invalid entry status');
  if (status === 'administered' && event.time > reference) {
    const error = new RangeError('Future entries must be planned'); error.code = 'FUTURE_ADMINISTERED'; throw error;
  }
  return { ...event, entryStatus: status };
}

// New starts get distinct series. Parallel intent must be explicit if any pump exists.
export function startInfusion(events, event, parallel = false) {
  validateEvent(event);
  const existing = events.some(e => e.type === 'infusion' && e.drug === event.drug);
  if (existing && !parallel) {
    const error = new RangeError('Choose an existing pump or explicitly add a parallel pump');
    error.code = 'AMBIGUOUS_INFUSION'; throw error;
  }
  const tagged = { ...event, seriesId: `pump:${newEventId()}`, seriesLabel: nextPumpLabel(events,event.drug), seriesOrigin: parallel ? 'parallel' : 'start' };
  return scheduleEvent(events, tagged, true);
}

// Adopt ONLY the selected legacy record. Other unmarked/parallel pumps stay intact.
export function applyInfusionAction(events, targetId, kind, event, revision) {
  const target = events.find(e => e.id === targetId && e.type === 'infusion');
  if (!target || !['change', 'stop', 'restart'].includes(kind)) throw new RangeError('Missing pump');
  const group = infusionGroups(events).find(g => g.records.some(e => e.id === targetId));
  if (revision && JSON.stringify(group.records) !== revision) {
    const error = new RangeError('The pump changed while editing'); error.code = 'DRAFT_STALE'; throw error;
  }
  if (event.drug !== target.drug || event.time < group.first.time) throw new RangeError('Invalid pump action');
  const seriesId = target.seriesId && !target.parallel ? target.seriesId : `pump:${newEventId()}`;
  const seriesLabel = target.seriesLabel || nextPumpLabel(events,target.drug);
  const adopted = events.map(e => e.id === target.id ? { ...e, seriesId, seriesLabel, parallel: false } : e);
  const next = { ...event, seriesId, seriesLabel, action: kind, parallel: false };
  if (kind === 'stop') { next.rate = 0; next.originalRate = 0; next.isInfinite = true; next.duration = 60; }
  validateEvent(next);
  return scheduleEvent(adopted, next, true);
}

// Removing plans also recomputes boundaries they imposed on actual infusions.
export function eventsForCalculation(events, includePlanned = true) {
  if (includePlanned) return events;
  let actual = events;
  for (const event of events.filter(e => eventStatus(e) === 'planned')) actual = removeScheduledEvent(actual, event.id);
  return actual;
}

export function formatEntryTime(minute, clockMode, start = '09:00') {
  if (!Number.isFinite(minute)) return '—';
  if (!clockMode) return `${minute} min`;
  const [h, m] = start.split(':').map(Number);
  const absolute = h * 60 + m + Math.round(minute);
  const day = Math.floor(absolute / 1440);
  const clock = ((absolute % 1440) + 1440) % 1440;
  return `${day ? `${day > 0 ? '+' : ''}${day}d ` : ''}${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')} · ${minute} min`;
}
