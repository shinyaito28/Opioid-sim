// Match the X-range bar's square-root mapping, with positive, drug-relative bounds.
export function yAxisSlider(automaticMax,manualMax=null) {
  const automatic=Number.isFinite(automaticMax)&&automaticMax>0?automaticMax:1;
  const manual=Number.isFinite(manualMax)&&manualMax>0?manualMax:null;
  const lower=Math.min(Math.max(Number.MIN_VALUE,automatic/20),manual??Infinity);
  const upper=Math.max(Math.min(Number.MAX_VALUE,automatic*5),manual??0);
  return {min:Math.sqrt(lower),max:Math.sqrt(upper),value:Math.sqrt(manual??automatic),lower,upper};
}

export function yAxisFromSlider(raw,slider) {
  if(raw==='')return null;
  const root=Number(raw);
  if(!Number.isFinite(root)||root<=0)return null;
  const value=Math.max(slider.min,Math.min(slider.max,root))**2;
  const rounded=Number(value.toPrecision(3));
  const upper=Math.max(slider.lower,Math.min(slider.upper,Number.isFinite(rounded)?rounded:value));
  return Number.isFinite(upper)&&upper>0?upper:null;
}

export function suggestedYAxisMax(data,band) {
  const peak=data.reduce((max,p)=>Math.max(max,p.cp??0,p.ce??0),band?.upper??0);
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
