import { getDoseUnitForDrug } from '../lib/drugs.js';
import { infusionText } from '../lib/display.js';
import { clockParts, legacyStreams } from '../lib/simpleInput.js';

export default function SimpleHistory({events,drug,patient,startTime,onEdit,onDelete,editingId,t}) {
  const rows=events.filter(e=>e.drug===drug).sort((a,b)=>a.time-b.time);
  const legacy=legacyStreams(events,drug);
  return <section className="history-panel" data-testid="simple-history">
    <h2>{t('entryHistory')}</h2>
    {!rows.length&&<p className="muted">{t('noHistory')}</p>}
    {rows.map(e=>{
      const clock=clockParts(e.time,startTime), locked=legacy&&e.type==='infusion';
      return <div key={e.id} className={'history-row '+(editingId===e.id?'editing-row':'')} data-event-id={e.id}>
        <button type="button" className="history-edit" onClick={()=>onEdit(e)} disabled={locked}>
          <span className="history-clock">{clock.hour}:{clock.minute}{clock.day!==0&&<small>{clock.day>0?'+':''}{clock.day}d</small>}</span>
          <span className="history-value">{e.type==='bolus'?t('bolusLabel')+' · '+e.amount+' '+getDoseUnitForDrug(drug):
            e.rate===0?t('entryStop'):infusionText(e,patient.weight)}
            {locked&&<small>{e.seriesLabel||t('simpleImported')}</small>}</span>
          <span className="history-edit-label">{locked?t('simplePreserved'):t('entryEdit')}</span>
        </button>
        <button type="button" className="delete-button" aria-label={t('simpleDeleteEvent')} disabled={locked}
          onClick={()=>onDelete(e.id)}>×</button>
      </div>;
    })}
  </section>;
}
