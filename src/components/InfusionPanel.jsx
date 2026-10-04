import { useMemo, useRef, useState } from 'react';
import { infusionGroups, activeInfusion, eventsForCalculation, formatEntryTime } from '../lib/workflow';
import { infusionDisplay, infusionText } from '../lib/display';
import { DRUG_UNITS, DRUG_SHORT_NAMES, convertToStandardUnit, convertFromStandardUnit } from '../lib/drugs';
import { isValidPatient, positiveInput } from '../lib/validation';
import EntryTimeControls from './EntryTimeControls';

export default function InfusionPanel({events,patient,reference,isClockMode,startTime,onAction,onParallel,t}) {
  const groups=useMemo(()=>infusionGroups(events),[events]);
  const [draft,setDraft]=useState(null);
  const submitting=useRef(false);
  const open=(group,kind)=>{
    const at=activeInfusion(group,reference);
    const source=at?.rate>0?at:[...group.records].reverse().find(e=>e.rate>0)||group.first;
    const displayed=infusionDisplay(source,patient.weight);
    const limit=source.seriesLimit || {duration:source.duration,isInfinite:source.isInfinite};
    const minute=Math.max(reference,group.first.time);
    const endMinute=source.time+limit.duration;
    submitting.current=false;
    setDraft({targetId:group.first.id,drug:group.first.drug,label:group.label,kind,minute,
      infinite:kind!=='change'||limit.isInfinite===true,endMinute:Number.isFinite(endMinute)?endMinute:minute+60,
      rate:kind==='stop'?'0':String(displayed.value),unit:displayed.unit,revision:JSON.stringify(group.records),status:'administered'});
  };
  const update=patch=>{submitting.current=false;setDraft(prev=>({...prev,...patch}))};
  const changeUnit=unit=>{
    let rate=draft.rate;
    if(positiveInput(rate)&&isValidPatient(patient))try{rate=String(Number(convertFromStandardUnit(convertToStandardUnit(Number(rate),draft.unit,patient.weight,draft.drug),unit,patient.weight,draft.drug).toPrecision(12)))}catch{rate=''}
    update({unit,rate});
  };
  const save=()=>{
    if(!draft || submitting.current)return;
    submitting.current=true;
    const entryStatus=draft.minute>reference?'planned':draft.status;
    if(onAction({...draft,rate:Number(draft.rate),duration:draft.endMinute-draft.minute,entryStatus})){setDraft(null)}else{submitting.current=false}
  };
  const valid=draft && isValidPatient(patient) && Number.isFinite(draft.minute) && Math.abs(draft.minute)<=1440 &&
    (draft.kind==='stop'||positiveInput(draft.rate) && (draft.infinite || Number.isFinite(draft.endMinute) && draft.endMinute>draft.minute && draft.endMinute-draft.minute<=1440));
  const actionKey={change:'entryChangeRate',stop:'entryStop',restart:'entryRestart'};
  return <section data-testid="infusion-panel" className="scroll-mt-32 sm:scroll-mt-20 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 sm:p-4 space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap"><h2 className="font-bold">{t('entryPumps')}</h2><span className="text-xs text-slate-500">{t('entryPumpHint')}</span></div>
    {!groups.length&&<p className="text-sm text-slate-500">{t('entryNoPump')}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map(group=>{
        const actual=eventsForCalculation(group.records,false);
        const current=activeInfusion({...group,records:actual},reference);
        const planned=group.records.filter(e=>e.entryStatus==='planned');
        const running=current?.rate>0;
        return <article key={group.key} data-pump-id={group.first.id} className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-2 min-w-0">
          <div className="flex justify-between items-center gap-2"><h3 className="font-bold text-sm">{DRUG_SHORT_NAMES[group.first.drug]} <span className="text-slate-500">{group.label}</span></h3><span className={`text-xs rounded-full px-2 py-1 ${running?'bg-emerald-100 text-emerald-800':'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>{t(running?'entryRunning':current?'entryStopped':'entryNotStarted')}</span></div>
          <p className="font-mono text-lg font-semibold">{running?infusionText(current,patient.weight):'—'}</p>
          <p className="text-xs text-slate-500">{current?`${t('entryLastChange')} · ${formatEntryTime(current.time,isClockMode,startTime)}`:t('entryNoActualRate')}</p>
          {group.records.some(e=>!e.entryStatus)&&<p className="text-xs text-slate-500">{t('entryUnclassified')}</p>}
          {planned.length>0&&<p className="text-xs text-amber-700 dark:text-amber-300">{t('entryPlanCount',{count:planned.length})} · {formatEntryTime(planned[0].time,isClockMode,startTime)}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" data-pump-action={running?'change':'restart'} onClick={()=>open(group,running?'change':'restart')} className="rounded-lg px-3 py-2 text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200">{t(running?'entryChangeRate':'entryRestart')}</button>
            <button type="button" data-pump-action="stop" onClick={()=>open(group,'stop')} className="rounded-lg px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700">{t('entryStop')}</button>
            <button type="button" data-pump-action="parallel" onClick={()=>{setDraft(null);onParallel(group.first.drug)}} className="rounded-lg px-3 py-2 text-xs text-slate-500 underline">{t('entrySeparatePump')}</button>
          </div>
        </article>;
      })}
    </div>
    {draft&&<div data-testid="pump-editor" className="scroll-mt-32 sm:scroll-mt-20 rounded-xl border-2 border-blue-400 bg-blue-50 dark:bg-slate-900 p-3 sm:p-4 space-y-3">
      <div className="flex justify-between items-center gap-2"><h3 className="font-bold">{DRUG_SHORT_NAMES[draft.drug]} {draft.label} · {t(actionKey[draft.kind])}</h3><button type="button" data-testid="pump-back" onClick={()=>setDraft(null)} className="text-xs text-slate-500">{t('entryBack')}</button></div>
      {draft.kind!=='stop'&&<div className="flex gap-2 items-center flex-wrap"><label className="text-xs">{t('entryNewRate')}<input data-testid="pump-rate" type="number" min="0" step="any" inputMode="decimal" value={draft.rate} onChange={e=>update({rate:e.target.value})} className="ml-2 w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 font-bold text-lg"/></label>
        <select data-testid="pump-unit" aria-label={t('unit')} value={draft.unit} onChange={e=>changeUnit(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-sm">{DRUG_UNITS[draft.drug].map(u=><option key={u}>{u}</option>)}</select></div>}
      <EntryTimeControls minute={draft.minute} setMinute={minute=>update({minute})} reference={reference} isClockMode={isClockMode} startTime={startTime} t={t} prefix="pump"/>
      {draft.kind!=='stop'&&<div className="text-xs space-y-2"><label className="flex gap-2 items-center"><input data-testid="pump-infinite" type="checkbox" checked={draft.infinite} onChange={e=>update({infinite:e.target.checked})}/>{t('entryUntilStop')}</label>
        {!draft.infinite&&<label className="flex gap-2 items-center flex-wrap">{t('entryKeepEnd')}<input data-testid="pump-end" type="number" step="any" value={Number.isFinite(draft.endMinute)?draft.endMinute:''} onChange={e=>update({endMinute:e.target.value===''?NaN:Number(e.target.value)})} className="w-20 rounded border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 p-2"/>min · {formatEntryTime(draft.endMinute,isClockMode,startTime)}</label>}
      </div>}
      <p className="text-xs text-slate-500">{t(draft.kind==='stop'?'entryStopHint':'entryChangeHint')}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 text-xs">{['administered','planned'].map(status=><button type="button" key={status} data-testid={`pump-status-${status}`} disabled={status==='administered'&&draft.minute>reference} onClick={()=>update({status})} className={`rounded-lg px-3 py-2 font-semibold ${(draft.minute>reference?'planned':draft.status)===status?'bg-slate-800 text-white dark:bg-blue-600':'bg-white dark:bg-slate-800'} disabled:opacity-40`}>{t(status==='planned'?'entryPlanned':'entryAdministered')}</button>)}</div>
        <div className="flex gap-2"><button type="button" data-testid="pump-cancel" onClick={()=>setDraft(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500">{t('cancel')}</button><button type="button" data-testid="pump-submit" onClick={save} disabled={!valid || submitting.current} className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-bold disabled:opacity-40">{t(draft.minute>reference||draft.status==='planned'?'entrySavePlan':'entryConfirmAction')}</button></div>
      </div>
    </div>}
  </section>;
}
