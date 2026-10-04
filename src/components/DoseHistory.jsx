import { useState } from 'react';
import { DRUG_SHORT_NAMES, getDoseUnitForDrug } from '../lib/drugs';
import { infusionText } from '../lib/display';
import { eventStatus, formatEntryTime } from '../lib/workflow';

export default function DoseHistory({events,patient,reference,isClockMode,startTime,onEdit,onDelete,onStatus,t}) {
  const [confirm,setConfirm]=useState(null);
  const [filter,setFilter]=useState('all');
  const sorted=[...events].sort((a,b)=>a.time-b.time);
  const keys=['administered','planned','unclassified'];
  const title={administered:'entryAdministered',planned:'entryPlanned',unclassified:'entryUnclassified'};
  return <section data-testid="dose-history" className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 sm:p-4 space-y-3">
    <div className="flex flex-wrap justify-between items-center gap-2"><h2 className="font-bold">{t('entryHistory')}</h2><span className="text-xs text-slate-500">{t('entryNoAutoActual')}</span></div>
    <div className="flex gap-2 flex-wrap text-xs">{['all',...keys].map(key=><button type="button" key={key} data-testid={`history-filter-${key}`} onClick={()=>setFilter(key)} className={`rounded-lg px-3 py-2 ${filter===key?'bg-slate-800 text-white dark:bg-blue-600':'bg-slate-100 dark:bg-slate-700'}`}>{key==='all'?t('entryAll'):t(title[key])} · {key==='all'?events.length:events.filter(e=>eventStatus(e)===key).length}</button>)}</div>
    {!events.length&&<p className="text-sm text-slate-500">{t('noHistory')}</p>}
    <div className="grid sm:grid-cols-2 gap-3">{keys.filter(key=>filter==='all'||filter===key).map(key=>{
      const rows=sorted.filter(e=>eventStatus(e)===key);
      if(!rows.length)return null;
      return <div key={key} data-history-group={key} className="space-y-1 min-w-0"><h3 className={`font-bold text-xs pt-1 ${key==='planned'?'text-amber-600':'text-slate-500'}`}>{t(title[key])}</h3><div className="space-y-1 max-h-64 overflow-y-auto">
        {rows.map(event=><article key={event.id} data-event-id={event.id} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2 sm:p-3 flex flex-wrap justify-between gap-2 items-center">
          <div className="min-w-0"><div className="flex gap-2 items-center flex-wrap"><strong className="text-sm">{DRUG_SHORT_NAMES[event.drug]} {event.seriesLabel||''}</strong><span className="text-xs font-mono text-slate-500">{formatEntryTime(event.time,isClockMode,startTime)}</span></div>
            <p className="text-sm">{event.type==='bolus'?`${t('bolusLabel')} · ${event.amount} ${getDoseUnitForDrug(event.drug)}`:event.rate===0?t('entryStop'):infusionText(event,patient.weight)}</p>
            {key==='planned'&&event.time<=reference&&<p className="text-xs text-amber-600">{t('entryPastPlan')}</p>}
          </div>
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <button type="button" data-history-action="edit" onClick={()=>onEdit(event)} className="rounded-lg px-2 py-2 text-blue-600 bg-blue-50 dark:bg-blue-950">{t('entryEdit')}</button>
            <button type="button" data-history-action="delete" onClick={()=>setConfirm({id:event.id,kind:'delete'})} className="rounded-lg px-2 py-2 text-slate-500">{t('deleteTooltip')}</button>
            {key!=='administered'&&<button type="button" data-history-action="actual" disabled={event.time>reference} onClick={()=>setConfirm({id:event.id,kind:'actual'})} className="rounded-lg px-2 py-2 text-emerald-700 dark:text-emerald-300 disabled:opacity-40">{t('entryMarkActual')}</button>}
          </div>
        </article>)}
      </div></div>;
    })}</div>
    {confirm&&<div data-testid="history-confirm" className="border border-slate-300 dark:border-slate-600 rounded-xl p-3 space-y-2">
      <p className="text-sm font-semibold">{t(confirm.kind==='delete'?'entryDeleteConfirm':'entryActualConfirm')}</p>
      <p className="text-xs font-mono">{(()=>{const event=events.find(e=>e.id===confirm.id);return event?`${DRUG_SHORT_NAMES[event.drug]} · ${formatEntryTime(event.time,isClockMode,startTime)}`:''})()}</p>
      <div className="flex gap-2"><button type="button" data-testid="history-confirm-cancel" onClick={()=>setConfirm(null)} className="px-3 py-2 text-sm text-slate-500">{t('cancel')}</button><button type="button" data-testid="history-confirm-save" onClick={()=>{const ok=confirm.kind==='delete'?onDelete(confirm.id):onStatus(confirm.id,'administered');if(ok)setConfirm(null)}} className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm">{t('entryConfirm')}</button></div>
    </div>}
  </section>;
}
