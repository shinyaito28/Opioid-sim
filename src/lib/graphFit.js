import {MAX_SIM_MINUTES} from './validation.js';

// These are view bounds in the existing case clock, never a new clock origin.
export function fitGraphRange(events,drug) {
  const records=events.filter(event=>event.drug===drug);
  if(!records.length)return {start:0,end:120};
  const first=Math.min(...records.map(event=>event.time));
  const last=Math.max(...records.map(event=>event.type==='infusion'&&event.rate>0&&!event.isInfinite?
    event.time+event.duration:event.time));
  // Preserve a useful forecast: at least two hours in view and an hour after
  // the last recorded change/finite end, within the supported case horizon.
  const end=Math.min(MAX_SIM_MINUTES,Math.max(1,first+120,last+60));
  return {start:Math.max(-MAX_SIM_MINUTES,Math.min(first,end-1)),end};
}

// Zoom the span from the current left anchor. The old absolute-right-edge
// mapping moved the anchor back toward the original case time after a fit.
export function xAxisSlider(range) {
  const upper=MAX_SIM_MINUTES-range.start,span=range.end-range.start;
  const lower=Math.min(upper,span,Math.max(30,1-range.start));
  return {min:Math.sqrt(lower),max:Math.sqrt(upper),value:Math.sqrt(span),lower,upper,start:range.start};
}

export function xAxisFromSlider(raw,slider) {
  if(raw==='')return null;
  const root=Number(raw);
  if(!Number.isFinite(root)||root<=0)return null;
  const span=Math.max(slider.lower,Math.min(slider.upper,Math.round(Math.max(slider.min,Math.min(slider.max,root))**2/10)*10));
  return {start:slider.start,end:Math.min(MAX_SIM_MINUTES,Math.max(1,Number((slider.start+span).toPrecision(12))))};
}
