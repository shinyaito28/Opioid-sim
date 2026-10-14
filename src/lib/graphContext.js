import {clockParts} from './simpleInput.js';
import {MAX_SIM_MINUTES} from './validation.js';

// View-only lead-in: five minutes at the default scale, smaller when zoomed in.
// Keep the stored bounds and the simulator's supported history window intact.
export function graphDisplayRange(range) {
  const leadIn=Math.min(5,(range.end-range.start)*.05);
  return {start:Math.max(-MAX_SIM_MINUTES,range.start-leadIn),end:range.end};
}

export function graphSampleStart(range,events) {
  return Math.min(0,graphDisplayRange(range).start,...events.map(e=>e.time));
}

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
