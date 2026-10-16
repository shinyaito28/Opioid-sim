import {useState} from 'react';
import {eventDescription,markerClock} from '../lib/doseMarkers.js';
import {legacyStreams} from '../lib/simpleInput.js';
import InlineEventEditor from './InlineEventEditor';

export default function SimpleHistory({events,drug,patient,startTime,onEdit,onDelete,editingId,editingEvent,editSession,onApply,onDone,t}) {
  const [expanded,setExpanded]=useState(false);
  const rows=events.filter(e=>e.drug===drug).sort((a,b)=>a.time-b.time),legacy=legacyStreams(events,drug);
  const visible=expanded?rows:rows.slice(-4);
  return <section className="history-panel quick-history" data-testid="simple-history">
    <div className="history-heading"><h2>{t('entryHistory')} <small>({rows.length})</small></h2>
      {rows.length>4&&<button type="button" className="quiet-button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{t(expanded?'historyLess':'historyAll',{count:rows.length})}</button>}</div>
    {editingEvent&&editingEvent.drug===drug&&<div className="quick-editor-anchor">
      <p className="quick-edit-title">{eventDescription(editingEvent,events,patient.weight,t)}</p>
      <InlineEventEditor key={editingEvent.id+':'+editSession} event={editingEvent} patient={patient} startTime={startTime}
        session={editSession} onEdit={onApply} onDone={onDone} t={t}/>
    </div>}
    {!rows.length&&<p className="muted">{t('noHistory')}</p>}
    <div className="history-compact-list">{visible.map(e=>{
      const locked=legacy&&e.type==='infusion';
      return <div key={e.id} className={'history-row '+(editingId===e.id?'editing-row':'')} data-event-id={e.id}>
        <button type="button" className="history-edit" onClick={()=>onEdit(e)} disabled={locked} aria-pressed={editingId===e.id}>
          <span className="history-clock">{markerClock(e.time,startTime)}</span>
          <span className="history-value">{eventDescription(e,events,patient.weight,t)}{locked&&<small>{e.seriesLabel||t('simplePreserved')}</small>}</span>
          <span className="history-edit-label">{t('entryEdit')}</span>
        </button>
        <button type="button" className="delete-button" aria-label={t('simpleDeleteEvent')} disabled={locked} onClick={()=>onDelete(e.id)}>×</button>
      </div>;
    })}</div>
  </section>;
}
