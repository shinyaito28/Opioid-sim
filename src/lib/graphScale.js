// Axis values are display units. Incomplete edits preserve the last valid limit.
export function parseYAxisMax(value) {
  if(!/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))return null;
  const number=Number(value);
  return Number.isFinite(number)&&number>0?number:null;
}

export function suggestedYAxisMax(data,band) {
  const peak=Math.max(0,...data.flatMap(p=>[p.cp,p.ce??0]),band?.upper??0);
  const rounded=Number((peak*1.1).toPrecision(3));
  return peak>0?(Number.isFinite(rounded)?rounded:peak):1;
}

export function concentrationBand(drug,thresholds,divisor) {
  const analgesia=thresholds?.analgesiaMin!=null&&thresholds?.analgesiaMax!=null;
  const lower=analgesia?thresholds.analgesiaMin:thresholds?.bisTarget?.min;
  const upper=analgesia?thresholds.analgesiaMax:thresholds?.bisTarget?.max;
  if(!Number.isFinite(lower)||!Number.isFinite(upper)||lower<0||upper<=lower)return null;
  return {lower:lower/divisor,upper:upper/divisor,labelKey:analgesia?'graphBandAnalgesia':
    drug==='Propofol'?'graphBandPropofol':drug==='Remimazolam'?'graphBandRemimazolam':'graphBandReference'};
}
