import { validateSnapshot } from './state.js';
export const SIMPLE_KEY = 'opioid_sim_data_v5';
export const LEGACY_KEY = 'opioid_sim_data';
export const BACKUP_KEY = 'opioid_sim_original_before_v5';
export function caseFingerprint(snapshot) {
  const {savedScenarios,savedTraces,...data}=snapshot;
  return JSON.stringify(data);
}

export function validateSimpleSnapshot(input) {
  if (!input || (input.schemaVersion != null && (!Number.isInteger(input.schemaVersion)||input.schemaVersion<1||input.schemaVersion>5))) throw new RangeError('Unsupported save');
  const checked = validateSnapshot({...input,schemaVersion:4});
  if (checked.plotStart != null && (!Number.isFinite(checked.plotStart) || checked.plotStart < -1440 || checked.plotStart >= checked.simDuration)) throw new RangeError('Invalid display range');
  if (checked.entryMinute != null && (!Number.isFinite(checked.entryMinute) || Math.abs(checked.entryMinute)>1440)) throw new RangeError('Invalid entry clock');
  if (checked.manualRange != null && typeof checked.manualRange !== 'boolean') throw new TypeError('Invalid display preference');
  return {...checked,schemaVersion:5};
}

export function readSimpleStorage(storage) {
  const current = storage.getItem(SIMPLE_KEY);
  if (current) return { data:validateSimpleSnapshot(JSON.parse(current)), imported:false };
  const raw = storage.getItem(LEGACY_KEY);
  if (!raw) return {data:null,imported:false};
  const data = validateSimpleSnapshot(JSON.parse(raw));
  const previous = storage.getItem(BACKUP_KEY);
  if (previous && previous !== raw) throw new RangeError('A different original backup already exists');
  if (!previous) storage.setItem(BACKUP_KEY,raw);
  if (storage.getItem(BACKUP_KEY) !== raw) throw new Error('Original backup was not saved');
  return {data,imported:true};
}

export function writeSimpleStorage(storage,snapshot) {
  const checked = validateSimpleSnapshot(snapshot);
  storage.setItem(SIMPLE_KEY,JSON.stringify(checked));
  return checked;
}
