import { validateEvent, newEventId, MAX_SIM_MINUTES } from './validation.js';
import { infusionGroups } from './workflow.js';

export function decimalInput(text, positive = true) {
  const value = String(text).replace(',', '.');
  if (value === '' || value === '.' || /^\d+\.$/.test(value)) return { status: 'pending' };
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return { status: 'invalid' };
  const number = Number(value);
  return Number.isFinite(number) && (positive ? number > 0 : number >= 0)
    ? { status: 'valid', value: number } : { status: 'invalid' };
}

export function clockFields(hour,minute,blur=false) {
  if(hour===''||minute==='')return {status:'pending'};
  if(!/^\d{1,2}$/.test(hour)||!/^\d{1,2}$/.test(minute))return {status:'invalid'};
  if(Number(hour)>23||Number(minute)>59)return {status:'invalid'};
  if(!blur&&(hour.length!==2||minute.length!==2))return {status:'pending'};
  return {status:'valid',hour:hour.padStart(2,'0'),minute:minute.padStart(2,'0')};
}

export function legacyStreams(events, drug) {
  const records=events.filter(e=>e.drug===drug&&e.type==='infusion').sort((a,b)=>a.time-b.time);
  if(infusionGroups(records).length>1)return true;
  return records.some((e,index)=>e.rate>0&&records.slice(index+1).some(next=>
    next.time < (e.isInfinite?Infinity:e.time+e.duration)));
}

export function normalizeSingle(events, drug) {
  const points = events.filter(e => e.drug === drug && e.type === 'infusion' && e.uiSingle)
    .sort((a,b) => a.time-b.time);
  const normalized = new Map();
  for (let i=1;i<points.length;i++) {
    if(points[i].time===points[i-1].time) {
      const error=new RangeError('An infusion setting already exists at this time');
      error.code='RATE_COLLISION';throw error;
    }
  }
  points.forEach((e,index) => {
    if (index && e.time === points[index-1].time) {
      const error = new RangeError('An infusion setting already exists at this time');
      error.code = 'RATE_COLLISION'; throw error;
    }
    const next = points[index+1];
    const record = { ...e, seriesId: `single:${drug}`, parallel: false,
      duration: next ? next.time-e.time : 60, isInfinite: !next };
    delete record.seriesLimit;
    validateEvent(record); normalized.set(e.id, record);
  });
  return events.map(e => normalized.get(e.id) || e);
}

// Preserve the raw imported save separately. Adoption retains event IDs and every
// effective finite stop; it is permitted only for one existing stream.
export function adoptSingle(events, drug) {
  if (legacyStreams(events,drug)) {
    const error = new RangeError('Multiple imported streams are preserved');
    error.code = 'LEGACY_STREAMS'; throw error;
  }
  const records = events.filter(e => e.drug === drug && e.type === 'infusion');
  if (records.every(e => e.uiSingle)) return events;
  const added = [];
  const adopted = events.map(e => {
    if (e.drug !== drug || e.type !== 'infusion') return e;
    const end = e.time + e.duration;
    if (!e.isInfinite && !records.some(other => other.id !== e.id && other.time === end)) {
      added.push({ id: `finite-stop:${e.id}`, drug, type:'infusion', time:end, rate:0,
        originalRate:0, originalUnit:e.originalUnit, duration:60, isInfinite:true,
        uiSingle:true, seriesId:`single:${drug}`, importedStopFor:e.id });
    }
    const result = { ...e, uiSingle:true, seriesId:`single:${drug}`, legacyRecord:{...e} };
    delete result.seriesLimit; return result;
  });
  return normalizeSingle([...adopted,...added],drug);
}

export function upsertCondition(events, event) {
  validateEvent(event);
  if (event.type === 'bolus') return events.some(e=>e.id===event.id)
    ? events.map(e=>e.id===event.id?event:e) : [...events,event];
  const adopted = adoptSingle(events,event.drug);
  const next = { ...event, uiSingle:true, seriesId:`single:${event.drug}`, parallel:false };
  delete next.seriesLimit;
  return normalizeSingle(adopted.some(e=>e.id===next.id)
    ? adopted.map(e=>e.id===next.id?next:e) : [...adopted,next],event.drug);
}

export function deleteCondition(events, id) {
  const old = events.find(e=>e.id===id);
  if (!old) return events;
  if (old.type === 'bolus') return events.filter(e=>e.id!==id);
  const adopted = adoptSingle(events,old.drug);
  return normalizeSingle(adopted.filter(e=>e.id!==id),old.drug);
}

export function createInfusion(drug,time,rate,unit,weight,convert,id = newEventId()) {
  return {id,drug,type:'infusion',time,rate:convert(rate,unit,weight,drug),
    originalRate:rate,originalUnit:unit,weightAtEntry:weight,duration:60,isInfinite:true,uiSingle:true};
}

export function editCondition(old,draft,weight,convert) {
  if(old.type!==draft.type||old.drug!==draft.drug)throw new RangeError('Mismatched edit');
  if(draft.type==='bolus')return {...old,time:draft.time,amount:draft.value};
  // A time-only edit uses the recorded absolute dose, never the current weight.
  if(!draft.rateChanged)return {...old,time:draft.time};
  return {...old,...createInfusion(draft.drug,draft.time,draft.value,draft.unit,weight,convert,old.id)};
}

export function clockParts(minute,start) {
  const [h,m] = start.split(':').map(Number);
  const absolute = h*60+m+Math.round(minute);
  const day = Math.floor(absolute/1440), value = ((absolute%1440)+1440)%1440;
  return { hour:String(Math.floor(value/60)).padStart(2,'0'), minute:String(value%60).padStart(2,'0'), day };
}

export function validEntryMinute(minute) {
  return Number.isFinite(minute) && Math.abs(minute)<=MAX_SIM_MINUTES;
}
