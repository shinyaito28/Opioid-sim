import {useEffect,useRef,useState} from 'react';
import {clockToMinutes} from '../lib/clock.js';
import {clockParts,decimalInput,validEntryMinute} from '../lib/simpleInput.js';
import {DRUG_UNITS,getDoseUnitForDrug,convertToStandardUnit,convertFromStandardUnit} from '../lib/drugs.js';
import {infusionDisplay} from '../lib/display.js';

export default function InlineEventEditor({event,patient,startTime,session,onEdit,onDone,t}) {
  const initial=clockParts(event.time,startTime);
  const [clock,setClock]=useState(initial.hour+':'+initial.minute),[minute,setMinute]=useState(event.time);
  const display=event.type==='infusion'?infusionDisplay(event,patient.weight):null;
  const [value,setValue]=useState(String(display?Number(display.value.toPrecision(12)):event.amount));
  const [unit,setUnit]=useState(display?.unit??getDoseUnitForDrug(event.drug)),[error,setError]=useState(false);
  const dirty=useRef(false),rateChanged=useRef(false),timer=useRef(),latest=useRef(),weight=useRef(patient.weight);
  const parsed=decimalInput(value,event.type==='bolus');
  const valid=parsed.status==='valid'&&/^\d{2}:\d{2}$/.test(clock)&&validEntryMinute(minute);
  latest.current={valid,parsed,minute,unit};
  const flush=()=>{
    clearTimeout(timer.current);const d=latest.current;
    if(!dirty.current||!d.valid)return;
    const ok=onEdit(event.id,{drug:event.drug,type:event.type,time:d.minute,value:d.parsed.value,unit:d.unit,rateChanged:rateChanged.current},session);
    setError(!ok);if(ok){dirty.current=false;rateChanged.current=false;}
  };
  useEffect(()=>{clearTimeout(timer.current);if(dirty.current&&valid)timer.current=setTimeout(flush,220);
    return()=>clearTimeout(timer.current);},[value,minute,clock,unit,valid]);
  useEffect(()=>{if(weight.current!==patient.weight&&event.type==='infusion'&&!rateChanged.current)
    setValue(String(Number(convertFromStandardUnit(event.rate,unit,patient.weight,event.drug).toPrecision(12))));
    weight.current=patient.weight;},[patient.weight]);
  const changeClock=text=>{
    setClock(text);dirty.current=true;setError(false);
    try{const next=clockToMinutes(text,startTime,minute);setMinute(validEntryMinute(next)?next:NaN);}catch{setMinute(NaN);}
  };
  const part=clockParts(Number.isFinite(minute)?minute:event.time,startTime);
  return <div className="inline-event-editor" data-testid="inline-event-editor" onKeyDown={e=>{
    if(e.key==='Enter'){e.preventDefault();flush();}if(e.key==='Escape'){e.preventDefault();flush();onDone();}
  }}>
    <div className="inline-edit-fields">
      <label><span className="field-label">{t('simpleTime')}</span><input type="time" step="60" value={clock}
        aria-label={t('quickEditTime')} onChange={e=>changeClock(e.target.value)} onBlur={flush}/></label>
      <label><span className="field-label">{t(event.type==='bolus'?'dose':'rate')}</span>
        <input type="text" inputMode="decimal" value={value} aria-label={t('quickEditValue')} onBlur={flush}
          onChange={e=>{setValue(e.target.value);dirty.current=true;rateChanged.current=event.type==='infusion';setError(false);}}/></label>
      {event.type==='infusion'?<label className="inline-unit"><span className="field-label">{t('unit')}</span>
        <select aria-label={t('quickEditUnit')} value={unit} onChange={e=>{
          if(parsed.status==='valid')setValue(String(Number(convertFromStandardUnit(convertToStandardUnit(parsed.value,unit,patient.weight,event.drug),e.target.value,patient.weight,event.drug).toPrecision(12))));
          setUnit(e.target.value);dirty.current=true;rateChanged.current=true;
        }}>{DRUG_UNITS[event.drug].map(u=><option key={u}>{u}</option>)}</select></label>:<span className="inline-dose-unit">{unit}</span>}
    </div>
    <div className="inline-edit-footer"><span aria-live="polite">{error?t('simpleEditRejected'):valid?t('simpleAutoApply'):t('simplePending')}{part.day?' · '+(part.day>0?'+':'')+part.day+'d':''}</span>
      <button type="button" className="quiet-button" onClick={()=>{flush();onDone();}}>{t('simpleDone')}</button></div>
  </div>;
}
