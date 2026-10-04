import { useEffect, useRef, useState } from 'react';
import { Plus, Minus, Syringe, Clock } from 'lucide-react';
import { isValidPatient, positiveInput, MAX_SIM_MINUTES } from '../lib/validation';
import { MAIN_DRUGS, formatEntryTime } from '../lib/workflow';
import { convertToStandardUnit, convertFromStandardUnit } from '../lib/drugs';
import EntryTimeControls from './EntryTimeControls';

const steps = { Fentanyl:25, Hydromorphone:.2, Morphine:1, Propofol:10, Remimazolam:1, Remifentanil:25, Sufentanil:5, Ketamine:5 };
export default function QuickEntry({drug,setDrug,patient,isClockMode,startTime,clockStartDate,onModeChange,referenceMinute,setReferenceMinute,
  reference,drugList,drugUnits,drugShortNames,clinicalDefaults,lastDoseByDrug,events,quickAddBolus,quickAddInfusion,quickIntent,t}) {
  const [type,setType]=useState('bolus');
  const [amount,setAmount]=useState('');
  const [rate,setRate]=useState('');
  const [unit,setUnit]=useState(drugUnits[drug][0]);
  const [duration,setDuration]=useState('60');
  const [infinite,setInfinite]=useState(true);
  const [parallel,setParallel]=useState(false);
  const [minute,setMinute]=useState(reference);
  const [status,setStatus]=useState('administered');
  const [message,setMessage]=useState('');
  const tracking=useRef(true);
  const submitted=useRef(false);
  useEffect(()=>{
    const last=lastDoseByDrug?.[drug];
    setAmount(last?.bolusAmount != null ? String(last.bolusAmount) : '');
    setRate(last?.infusionRate != null ? String(last.infusionRate) : '');
    setUnit(drugUnits[drug].includes(last?.infusionUnit) ? last.infusionUnit : drugUnits[drug][0]);
    setDuration(String(last?.infusionDuration ?? 60));setInfinite(last?.isInfinite ?? true);
    setParallel(false);setMessage('');submitted.current=false;
  },[drug]);
  useEffect(()=>{if(quickIntent){setType('infusion');setParallel(true);setRate('');setStatus('administered');setMessage('');submitted.current=false;tracking.current=true;setMinute(reference)}},[quickIntent]);
  useEffect(()=>{if(tracking.current)setMinute(reference)},[reference]);
  const time=value=>{tracking.current=false;setMinute(value);submitted.current=false;setMessage('');};
  const now=()=>{tracking.current=true;setMinute(reference);submitted.current=false;setMessage('');};
  const valid=isValidPatient(patient);
  const future=minute>reference;
  const entryStatus=future?'planned':status;
  const hasPump=events.some(e=>e.type==='infusion' && e.drug===drug);
  const allowed=valid && Number.isFinite(minute) && Math.abs(minute)<=MAX_SIM_MINUTES &&
    (type==='bolus'?positiveInput(amount):positiveInput(rate) && (infinite || positiveInput(duration) && Number(duration)<=MAX_SIM_MINUTES) && (!hasPump || parallel));
  const doseUnit=clinicalDefaults[drug]?.unit || 'mcg';
  const changeUnit=value=>{
    if(positiveInput(rate)&&valid)try{setRate(String(Number(convertFromStandardUnit(convertToStandardUnit(Number(rate),unit,patient.weight,drug),value,patient.weight,drug).toPrecision(12))))}catch{setRate('')}
    setUnit(value);submitted.current=false;
  };
  const submit=()=>{
    if(!allowed || submitted.current)return;
    submitted.current=true;
    const options={entryStatus,newSeries:true,parallel};
    const ok=type==='bolus'?quickAddBolus(drug,Number(amount),minute,options):quickAddInfusion(drug,Number(rate),unit,minute,Number(duration),infinite,options);
    if(!ok){submitted.current=false;return;}
    setMessage({drug,value:type==='bolus'?amount:rate,unit:type==='bolus'?doseUnit:unit,minute,entryStatus});
    setAmount('');setRate('');setParallel(false);tracking.current=true;setMinute(reference);
  };
  const clear=()=>{setAmount('');setRate('');setParallel(false);setStatus('administered');setMessage('');submitted.current=false;now();};
  const button='rounded-lg px-3 py-2 text-sm font-semibold min-h-10';
  return <section data-testid="quick-entry" className="scroll-mt-32 sm:scroll-mt-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 sm:p-4 space-y-3">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <h2 className="font-bold text-slate-800 dark:text-slate-100">{t('entryQuickTitle')}</h2>
      <span className="text-xs text-slate-500">{t('entrySelectionOnly')}</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
      {MAIN_DRUGS.map(d=><button type="button" key={d} data-drug={d} onClick={()=>setDrug(d)} aria-pressed={drug===d}
        className={`${button} min-w-0 last:col-span-2 md:last:col-span-1 text-left border ${drug===d?'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200':'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`}>
        <span className="block">{drugShortNames[d]}</span><span className="text-xs font-normal break-words">{t(`entryDrug${d}`)} · {clinicalDefaults[d].unit}</span>
      </button>)}
    </div>
    <details className="text-xs text-slate-500"><summary className="cursor-pointer">{t('entryOtherDrugs')}</summary>
      <div className="flex flex-wrap gap-2 pt-2">{drugList.filter(d=>!MAIN_DRUGS.includes(d)).map(d=><button type="button" key={d} data-drug={d} onClick={()=>setDrug(d)} className={`rounded-lg px-3 py-2 ${drug===d?'bg-blue-600 text-white':'bg-slate-100 dark:bg-slate-700'}`}>{drugShortNames[d]}</button>)}</div>
    </details>
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
        {[['bolus','Bolus',Syringe],['infusion','Inf',Clock]].map(([value,label,Icon])=><button type="button" key={value} onClick={()=>{setType(value);submitted.current=false;setMessage('')}} className={`${button} flex items-center gap-1 ${type===value?'bg-white dark:bg-slate-900 shadow text-blue-600':''}`} aria-pressed={type===value}><Icon className="w-4 h-4"/>{label}</button>)}
      </div>
      <span className="text-sm font-bold">{drugShortNames[drug]}</span>
      {type==='bolus'?<div className="flex items-center gap-2">
        <button type="button" aria-label={t('entryDecrease')} onClick={()=>{setAmount(String(Math.max(0,Number(((Number(amount)||0)-(steps[drug]||1)).toFixed(6)))));submitted.current=false}} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg"><Minus className="w-4 h-4"/></button>
        <input data-testid="quick-amount" aria-label={t('dose')} type="number" inputMode="decimal" min="0" step="any" placeholder={t('dose')} value={amount} onChange={e=>{setAmount(e.target.value);submitted.current=false;setMessage('')}} className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 font-bold text-lg"/>
        <button type="button" aria-label={t('entryIncrease')} onClick={()=>{setAmount(String(Number(((Number(amount)||0)+(steps[drug]||1)).toFixed(6))));submitted.current=false}} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg"><Plus className="w-4 h-4"/></button><span className="text-sm">{doseUnit}</span>
      </div>:<div className="flex flex-wrap items-center gap-2">
        <input data-testid="quick-rate" aria-label={t('rate')} type="number" inputMode="decimal" min="0" step="any" placeholder={t('rate')} value={rate} onChange={e=>{setRate(e.target.value);submitted.current=false;setMessage('')}} className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 font-bold text-lg"/>
        <select data-testid="quick-unit" aria-label={t('unit')} value={unit} onChange={e=>changeUnit(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-sm">{drugUnits[drug].map(u=><option key={u}>{u}</option>)}</select>
        <label className="text-xs flex gap-1 items-center"><input type="checkbox" checked={infinite} onChange={e=>{setInfinite(e.target.checked);submitted.current=false}}/>{t('entryUntilStop')}</label>
        {!infinite&&<label className="text-xs"><input data-testid="quick-duration" aria-label={t('duration')} type="number" min="1" step="any" value={duration} onChange={e=>{setDuration(e.target.value);submitted.current=false}} className="w-20 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 p-2"/> min</label>}
      </div>}
    </div>
    {type==='infusion'&&hasPump&&<div className="rounded-lg bg-amber-50 dark:bg-amber-950 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      <p>{t('entryUsePumpCard')}</p><label className="flex items-center gap-2 pt-2 font-semibold"><input data-testid="quick-parallel" type="checkbox" checked={parallel} onChange={e=>{setParallel(e.target.checked);submitted.current=false}}/>{t('entryParallelExplicit')}</label>
    </div>}
    <div className="flex flex-wrap gap-2 items-center text-xs">
      <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1"><button type="button" data-testid="quick-relative-mode" onClick={()=>onModeChange(false)} className={`px-2 py-2 rounded-lg ${!isClockMode?'bg-white dark:bg-slate-900 text-blue-600':''}`}>{t('entryMinutesMode')}</button><button type="button" data-testid="quick-clock-mode" onClick={()=>onModeChange(true)} className={`px-2 py-2 rounded-lg ${isClockMode?'bg-white dark:bg-slate-900 text-blue-600':''}`}>{t('entryClockMode')}</button></div>
      {!isClockMode&&<label className="flex items-center gap-2">{t('entryReferenceMinute')}<input data-testid="entry-reference" type="number" min="0" max="1440" value={referenceMinute} onChange={e=>{if(e.target.value!==''&&Number(e.target.value)>=0&&Number(e.target.value)<=1440)setReferenceMinute(Number(e.target.value))}} className="w-16 border border-slate-300 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-900"/> min</label>}
      {isClockMode&&<span>{t('entryReference')} · {formatEntryTime(reference,true,startTime)}</span>}
      <button type="button" data-testid="quick-now" onClick={now} className="text-blue-600 underline">{t('entryFollowNow')}</button>
    </div>
    {isClockMode&&<p className="text-xs text-slate-500">{t('entryAnchor')} · {clockStartDate} {startTime}</p>}
    <EntryTimeControls minute={minute} setMinute={time} reference={reference} isClockMode={isClockMode} startTime={startTime} t={t} prefix="quick"/>
    <div className="flex flex-wrap justify-between gap-2 items-center border-t border-slate-100 dark:border-slate-700 pt-3">
      <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1 text-xs">
        {['administered','planned'].map(value=><button type="button" key={value} data-testid={`quick-status-${value}`} disabled={value==='administered'&&future} onClick={()=>{setStatus(value);submitted.current=false}} aria-pressed={entryStatus===value} className={`px-3 py-2 rounded-lg font-bold disabled:opacity-40 ${entryStatus===value?(value==='planned'?'bg-amber-500 text-slate-950':'bg-emerald-600 text-white'):''}`}>{t(value==='planned'?'entryPlanned':'entryAdministered')}</button>)}
      </div>
      <div className="flex gap-2"><button type="button" data-testid="quick-cancel" onClick={clear} className={`${button} text-slate-500`}>{t('cancel')}</button>
        <button type="button" data-testid="quick-submit" disabled={!allowed || submitted.current} onClick={submit} className={`${button} ${entryStatus==='planned'?'bg-amber-500 text-slate-950':'bg-blue-600 text-white'} disabled:opacity-40`}>{t(entryStatus==='planned'?'entrySavePlan':'entryRecordDose')}</button></div>
    </div>
    {future&&<p className="text-xs text-amber-700 dark:text-amber-300">{t('entryFutureOnly')}</p>}
    {!valid&&<p role="alert" className="text-xs text-red-600">{t('patientInvalid')}</p>}
    {message&&<p role="status" data-testid="quick-feedback" className="text-xs text-emerald-700 dark:text-emerald-300">{t('entryRecorded')} · {drugShortNames[message.drug]} · {message.value} {message.unit} · {formatEntryTime(message.minute,isClockMode,startTime)} · {t(message.entryStatus==='planned'?'entryPlanned':'entryAdministered')}</p>}
  </section>;
}
