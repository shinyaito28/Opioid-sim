import {clockParts} from './simpleInput.js';

export function graphContext({range,startTime,currentMinute,events,drug}) {
  const format=minute=>{
    const p=clockParts(minute,startTime);
    return p.hour+':'+p.minute+(p.day?' ('+(p.day>0?'+':'')+p.day+'d)':'');
  };
  const doseTimes=events.filter(e=>e.drug===drug&&(e.type==='bolus'||e.rate>0)).map(e=>e.time);
  const first=doseTimes.length?Math.min(...doseTimes):null;
  return {start:format(range.start),end:format(range.end),spanMinutes:range.end-range.start,
    reference:format(0),now:format(currentMinute),firstDose:first==null?null:format(first)};
}
