import {getDoseUnitForDrug} from './drugs.js';
import {infusionText} from './display.js';
import {clockParts} from './simpleInput.js';

export function infusionKind(event,events) {
  if(event.rate===0)return 'stop';
  const previous=events.filter(e=>e.type==='infusion'&&e.drug===event.drug&&e.time<event.time&&
    (event.uiSingle||!event.seriesId||e.seriesId===event.seriesId)).sort((a,b)=>b.time-a.time)[0];
  return previous?.rate>0&&(previous.isInfinite||previous.time+previous.duration>=event.time)?'change':'start';
}

export function eventDoseValue(event,events,weight) {
  const kind=event.markerKind??(event.type==='bolus'?'bolus':infusionKind(event,events));
  const value=event.type==='bolus'?Number(event.amount.toPrecision(6))+' '+getDoseUnitForDrug(event.drug):
    infusionText(event,weight);
  return {kind,value};
}

export function eventDescription(event,events,weight,t) {
  const drug=t('entryDrug'+event.drug,{defaultValue:event.drug});
  const {kind,value}=eventDoseValue(event,events,weight);
  return drug+' · '+t('marker'+kind[0].toUpperCase()+kind.slice(1))+' · '+value;
}

export function markerClock(time,startTime) {
  const p=clockParts(time,startTime);
  return p.hour+':'+p.minute+(p.day?' ('+(p.day>0?'+':'')+p.day+'d)':'');
}

export function doseMarkers(events,drug,range,plotWidth=600,currentMinute=0) {
  const drugEvents=events.filter(e=>e.drug===drug),points=drugEvents.map(e=>({...e,sourceId:e.id}));
  // Imported finite infusions have a real end even without an explicit stop row.
  for(const e of drugEvents)if(e.type==='infusion'&&e.rate>0&&!e.isInfinite){
    const end=e.time+e.duration;
    if(!drugEvents.some(next=>next.type==='infusion'&&next.time===end&&
      (e.uiSingle||!e.seriesId||next.seriesId===e.seriesId)))
      points.push({...e,id:'end:'+e.id,sourceId:e.id,time:end,rate:0,markerKind:'end'});
  }
  const visible=points.filter(e=>e.time>=range.start&&e.time<=range.end).sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));
  const gap=(range.end-range.start)*44/Math.max(100,plotWidth),groups=[];
  for(const event of visible){
    let group=groups.at(-1);
    if(!group||event.time-group.time>gap){group={id:event.id,time:event.time,events:[]};groups.push(group);}
    group.events.push(event);
  }
  return groups.map(group=>({...group,future:group.events.every(e=>e.time>currentMinute),
    // Retain exact event coordinates even when one arrow summarizes a cluster.
    times:[...new Set(group.events.map(e=>e.time))]}));
}
