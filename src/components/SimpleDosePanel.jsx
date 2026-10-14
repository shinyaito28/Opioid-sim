import { useEffect, useRef, useState } from 'react';
import ClockInput from './ClockInput';
import { DRUG_UNITS, DRUG_LIST, getDoseUnitForDrug, convertToStandardUnit, convertFromStandardUnit } from '../lib/drugs.js';
import { infusionDisplay } from '../lib/display.js';
import { decimalInput, legacyStreams } from '../lib/simpleInput.js';

export default function SimpleDosePanel({ drug, onDrug, patient, events, minute, onMinute, startTime, onNow,
  editingEvent, editSession, onAdd, onEdit, onDone, patientValid = true, t }) {
  const [tab,setTab]=useState('bolus'), [amount,setAmount]=useState(''), [rate,setRate]=useState('');
  const [unit,setUnit]=useState(DRUG_UNITS[drug][0]), [pendingClock,setPendingClock]=useState(false);
  const [message,setMessage]=useState(''), [editError,setEditError]=useState('');
  const latest=useRef(null), timer=useRef(null), submitted=useRef(false), dirty=useRef(false), rateChanged=useRef(false);
  const weightContext=useRef({weight:patient.weight,id:editingEvent?.id});
  useEffect(()=>{
    clearTimeout(timer.current); dirty.current=false;rateChanged.current=false; submitted.current=false; setMessage('');setEditError('');setPendingClock(false);
    if (editingEvent) {
      setTab(editingEvent.type==='bolus'?'bolus':'infusion');
      setAmount(editingEvent.type==='bolus'?String(editingEvent.amount):'');
      if(editingEvent.type==='infusion') {
        const display=infusionDisplay(editingEvent,patient.weight);setRate(String(Number(display.value.toPrecision(12))));setUnit(display.unit);
      } else {setRate('');setUnit(DRUG_UNITS[drug][0]);}
    } else {setAmount('');setRate('');setUnit(DRUG_UNITS[drug][0]);}
  },[drug,editSession]);
  useEffect(()=>{
    const previous=weightContext.current;weightContext.current={weight:patient.weight,id:editingEvent?.id};
    if(previous.weight===patient.weight||previous.id!==editingEvent?.id)return;
    if(editingEvent?.type==='infusion'&&!rateChanged.current){
      const value=convertFromStandardUnit(editingEvent.rate,unit,patient.weight,drug);
      setRate(String(Number(value.toPrecision(12))));
    }
  },[patient.weight,editingEvent?.id]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const parsed=decimalInput(tab==='bolus'?amount:rate, !(editingEvent?.type==='infusion'&&editingEvent.rate===0));
  const legacy=tab==='infusion'&&legacyStreams(events,drug);
  const valid=parsed.status==='valid'&&!pendingClock&&!legacy&&patientValid;
  const activeRate=events.filter(e=>e.drug===drug&&e.type==='infusion'&&e.time<=minute&&(e.isInfinite||minute<e.time+e.duration))
    .reduce((sum,e)=>sum+e.rate,0);
  latest.current={tab,amount,rate,unit,minute,valid,parsed};
  const flush=()=>{
    clearTimeout(timer.current);
    if(!editingEvent||!dirty.current||!latest.current.valid)return;
    const d=latest.current;
    const ok=onEdit(editingEvent.id,{type:d.tab,drug,time:d.minute,value:d.parsed.value,unit:d.unit,rateChanged:rateChanged.current},editSession);
    setEditError(ok?'':t('simpleEditRejected'));
    if(ok){dirty.current=false;rateChanged.current=false;}
  };
  useEffect(()=>{
    if(!editingEvent||!dirty.current)return;
    clearTimeout(timer.current);
    if(valid)timer.current=setTimeout(flush,220);
    return()=>clearTimeout(timer.current);
  },[amount,rate,unit,minute,pendingClock,editingEvent?.id,valid]);
  const change=value=>{dirty.current=true;submitted.current=false;setMessage('');setEditError('');
    if(tab==='bolus')setAmount(value);else{setRate(value);rateChanged.current=true;}};
  const changeUnit=value=>{
    const parsedRate=decimalInput(rate,false);
    if(parsedRate.status==='valid')try{setRate(String(Number(convertFromStandardUnit(
      convertToStandardUnit(parsedRate.value,unit,patient.weight,drug),value,patient.weight,drug).toPrecision(12))))}catch{setRate('');}
    setUnit(value);dirty.current=true;submitted.current=false;
  };
  const changeTime=value=>{dirty.current=true;submitted.current=false;setEditError('');onMinute(value);};
  const add=()=>{
    if(!valid||submitted.current)return;
    submitted.current=true;
    if(onAdd({type:tab,drug,time:minute,value:parsed.value,unit})){
      setMessage(t('simpleAdded'));if(tab==='bolus')setAmount('');else setRate('');
    }else submitted.current=false;
  };
  const switchTab=value=>{flush();if(editingEvent)onDone();setTab(value);setMessage('');submitted.current=false;};
  return <section className="dose-panel" data-testid="simple-dose-panel">
    <div className="dose-heading">
      <label className="drug-select"><span className="field-label">{t('drug')}</span>
        <select aria-label={t('drug')} value={drug} onChange={e=>{flush();onDrug(e.target.value);}}>
          {DRUG_LIST.map(d=><option key={d} value={d}>{t('entryDrug'+d,{defaultValue:d})}</option>)}
        </select>
      </label>
      {editingEvent&&<div className="edit-badge"><span>{t('simpleEditing')}</span>
        <button type="button" className="quiet-button" onClick={()=>{flush();onDone();}}>{t('simpleDone')}</button></div>}
    </div>
    <ClockInput minute={minute} startTime={startTime} onChange={changeTime}
      onPending={value=>{setPendingClock(value);dirty.current=true;}} onNow={()=>{dirty.current=true;return onNow();}} t={t}/>
    <div className="dose-tabs" role="tablist" aria-label={t('simpleOperation')}>
      {['bolus','infusion'].map(value=><button type="button" role="tab" id={'tab-'+value} aria-controls="dose-fields"
        aria-selected={tab===value} tabIndex={tab===value?0:-1} key={value} onClick={()=>switchTab(value)}
        onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();switchTab(value==='bolus'?'infusion':'bolus');
          e.currentTarget.parentElement.querySelector('#tab-'+(value==='bolus'?'infusion':'bolus'))?.focus();}}}>{t(value==='bolus'?'bolusLabel':'infusionLabel')}</button>)}
    </div>
    <div id="dose-fields" role="tabpanel" aria-labelledby={'tab-'+tab} className="dose-fields">
      <label className="dose-value"><span className="field-label">{t(tab==='bolus'?'dose':'rate')}</span>
        <div className="value-unit"><input type="text" inputMode="decimal" autoComplete="off"
          data-testid={tab==='bolus'?'dose-amount':'dose-rate'} aria-label={t(tab==='bolus'?'dose':'rate')}
          value={tab==='bolus'?amount:rate} onChange={e=>change(e.target.value)} onBlur={flush}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(editingEvent)flush();else add();}}}/>
          {tab==='bolus'?<span>{getDoseUnitForDrug(drug)}</span>:
            <select aria-label={t('unit')} value={unit} onChange={e=>changeUnit(e.target.value)}>{DRUG_UNITS[drug].map(u=><option key={u}>{u}</option>)}</select>}
        </div>
      </label>
      {!editingEvent&&<div className="dose-actions">
        <button type="button" className="primary-button" disabled={!valid} onClick={add} data-testid="dose-add">
          {t(tab==='bolus'?'simpleAddBolus':'simpleSetRate')}</button>
      </div>}
      {tab==='infusion'&&<button type="button" className="stop-button" disabled={!!pendingClock||legacy||!patientValid||activeRate<=0}
        onClick={()=>{
          clearTimeout(timer.current);
          const draft={type:'infusion',drug,time:minute,value:0,unit,rateChanged:true};
          const ok=editingEvent?onEdit(editingEvent.id,draft,editSession):onAdd(draft);
          if(ok){dirty.current=false;setMessage(t('simpleStopped'));setRate(editingEvent?'0':'');}
        }} data-testid="dose-stop">{t('entryStop')}</button>}
    </div>
    <div className="input-status" aria-live="polite">
      {legacy?<p role="alert">{t('simpleLegacyStreams')}</p>:
        parsed.status==='invalid'||pendingClock==='invalid'?<p role="alert">{t('invalidInput')}</p>:
        pendingClock||(editingEvent&&parsed.status==='pending')?<p>{t('simplePending')}</p>:
        editError?<p role="alert">{editError}</p>:message?<p className="success-text">{message}</p>:
        editingEvent?<p>{t('simpleAutoApply')}</p>:null}
    </div>
  </section>;
}
