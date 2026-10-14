import {useEffect,useMemo,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import TopBar from './components/TopBar';
import SimpleDosePanel from './components/SimpleDosePanel';
import SimpleHistory from './components/SimpleHistory';
import SimpleGraph from './components/SimpleGraph';
import TherapeuticReferenceModal from './components/TherapeuticReferenceModal';
import {AVAILABLE_MODELS,DRUG_COLORS,DRUG_DISPLAY,THERAPEUTIC_RANGES,getPKParameters,convertToStandardUnit} from './lib/drugs.js';
import {getBestModel,getModelRequirements} from './lib/modelSelection.js';
import {processEvents,simulateConcentration} from './lib/simulation.js';
import {validatePatient,validateDuration,newEventId,isValidPatient} from './lib/validation.js';
import {CALCULATION_VERSION} from './lib/state.js';
import {elapsedMinutes,localDate} from './lib/clock.js';
import {upsertCondition,deleteCondition,createInfusion,editCondition,validEntryMinute,legacyStreams} from './lib/simpleInput.js';
import {BACKUP_KEY,LEGACY_KEY,readSimpleStorage,writeSimpleStorage,validateSimpleSnapshot,caseFingerprint} from './lib/simpleStorage.js';
import {createUndoHistory} from './lib/undo.js';
import {useDarkMode} from './hooks/useDarkMode';
import {estimateGrowth} from './lib/growth.js';

function freshCase() {
  const now=new Date(),start=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  return {schemaVersion:5,calculationVersion:CALCULATION_VERSION,patient:{age:10,weight:30,height:138,gender:'male'},
    drug:'Fentanyl',modelByDrug:{},events:[],simDuration:120,plotStart:0,manualRange:false,autoFillStats:false,
    therapeuticOverrides:{},savedTraces:[],savedScenarios:[],lastDoseByDrug:{},isClockMode:true,
    simSettings:{startTime:start,clockStartDate:localDate(now)},entryMinute:0,includePlanned:true};
}
function hydrate(data) {
  const defaults=freshCase(),d=validateSimpleSnapshot(data);
  return {...defaults,...d,isClockMode:true,simSettings:{startTime:d.simSettings?.startTime??d.startTime??defaults.simSettings.startTime,
    clockStartDate:d.simSettings?.clockStartDate??d.clockStartDate??defaults.simSettings.clockStartDate},
    entryMinute:validEntryMinute(d.entryMinute)?d.entryMinute:d.events.at(-1)?.time??0};
}
function calculate(s) {
  validatePatient(s.patient);validateDuration(s.simDuration);
  const data=new Map(),params=new Map(),first=Math.min(0,...s.events.map(e=>e.time));
  for(const drug of new Set([s.drug,...s.events.map(e=>e.drug)])) {
    const p=getPKParameters(drug,s.modelByDrug[drug]||getBestModel(drug,s.patient.age),s.patient);
    params.set(drug,p);data.set(drug,simulateConcentration(processEvents(s.events.filter(e=>e.drug===drug),s.simDuration),p,s.simDuration,drug,first));
  }
  return {data,params};
}
export default function App() {
  const {t,i18n}=useTranslation();
  const [state,setState]=useState(freshCase),[patientDraft,setPatientDraft]=useState(state.patient);
  const [storageReady,setStorageReady]=useState(false),[storageError,setStorageError]=useState(''),[inputError,setInputError]=useState('');
  const [now,setNow]=useState(()=>new Date()),[minute,setMinute]=useState(0),[editing,setEditing]=useState(null),[editSession,setEditSession]=useState(0);
  const [showRanges,setShowRanges]=useState(true),[referenceOpen,setReferenceOpen]=useState(false),[showTraces,setShowTraces]=useState(false);
  const [currentScenarioId,setCurrentScenarioId]=useState(null),[lastSavedAt,setLastSavedAt]=useState(null);
  const [isDark,setIsDark]=useDarkMode();
  const history=useRef(createUndoHistory(state)),latest=useRef(state),nextSession=useRef(0),panelRef=useRef(null);
  const scenarioBaseline=useRef(null);
  latest.current=state;
  useEffect(()=>{
    try {const restored=readSimpleStorage(localStorage);
      if(restored.data){const loaded=hydrate(restored.data);calculate(loaded);history.current.reset(loaded);
        latest.current=loaded;setState(loaded);setPatientDraft(loaded.patient);setMinute(loaded.entryMinute);}
      setStorageReady(true);
    }catch{setStorageError('savedStateInvalid');}
  },[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    if(!storageReady)return;
    try{writeSimpleStorage(localStorage,state);setLastSavedAt(Date.now());setStorageError('');}catch{setStorageError('saveFailed');}
  },[state,storageReady]);
  useEffect(()=>{
    const reveal=e=>{if(!panelRef.current?.contains(e.target)||!e.target.matches('input'))return;
      setTimeout(()=>{if(document.activeElement!==e.target)return;
        const v=window.visualViewport,bottom=(v?.height??window.innerHeight)+(v?.offsetTop??0),rect=e.target.getBoundingClientRect();
        if(rect.bottom>bottom-20)window.scrollBy({top:rect.bottom-bottom+32,behavior:'smooth'});},180);};
    document.addEventListener('focusin',reveal);return()=>document.removeEventListener('focusin',reveal);
  },[]);
  const computed=useMemo(()=>calculate(state),[state]);
  const accept=(patch,group=null)=>{
    try{const next=validateSimpleSnapshot({...latest.current,...patch});calculate(next);
      history.current.update(next,group);latest.current=next;setState(next);setInputError('');return true;
    }catch(error){setInputError(({RATE_COLLISION:'simpleRateCollision',LEGACY_STREAMS:'simpleLegacyStreams'})[error.code]||'invalidInput');return false;}
  };
  const start=state.simSettings.startTime,model=state.modelByDrug[state.drug]||getBestModel(state.drug,state.patient.age);
  const currentMinute=elapsedMinutes(now,state.simSettings.clockStartDate,start),data=computed.data.get(state.drug)||[],params=computed.params.get(state.drug);
  const editingEvent=editing==null?null:state.events.find(e=>e.id===editing);
  const done=()=>{setEditing(null);history.current.endGroup();};
  const entryNow=()=>{const s=latest.current,value=elapsedMinutes(new Date(),s.simSettings.clockStartDate,s.simSettings.startTime);
    if(validEntryMinute(value)){setMinute(value);setInputError('');return value;}setInputError('simpleClockWindow');return null;};
  const completePatient=()=>{
    if(!isValidPatient(patientDraft)){setInputError('patientInvalid');return;}
    if(!latest.current.events.length){const fresh=freshCase();if(accept({patient:patientDraft,simSettings:fresh.simSettings,entryMinute:0}))setMinute(0);}
    else entryNow();
  };
  const updatePatient=patient=>{
    const previous=latest.current.patient;
    if(latest.current.autoFillStats&&Number.isFinite(patient.age)&&(patient.age!==previous.age||patient.gender!==previous.gender))
      patient={...patient,...estimateGrowth(patient.age,patient.gender)};
    setPatientDraft(patient);if(isValidPatient(patient))accept({patient},'patient-edit');else setInputError('patientInvalid');
  };
  const condition=(d,id,old={})=>d.type==='bolus'?{...old,id,drug:d.drug,type:'bolus',time:d.time,amount:d.value}:
    {...old,...createInfusion(d.drug,d.time,d.value,d.unit,latest.current.patient.weight,convertToStandardUnit,id)};
  const report=error=>setInputError(({RATE_COLLISION:'simpleRateCollision',LEGACY_STREAMS:'simpleLegacyStreams'})[error.code]||'invalidInput');
  const add=d=>{
    try{const patch={events:upsertCondition(latest.current.events,condition(d,newEventId())),entryMinute:minute};
      if(!latest.current.manualRange){patch.plotStart=Math.min(latest.current.plotStart,d.time);patch.simDuration=Math.min(1440,Math.max(latest.current.simDuration,d.time+30));}
      return accept(patch);
    }catch(error){report(error);return false;}
  };
  const edit=(id,d,session)=>{
    const old=latest.current.events.find(e=>e.id===id);
    if(!old||old.drug!==d.drug||old.type!==d.type)return false;
    try{return accept({events:upsertCondition(latest.current.events,editCondition(old,d,latest.current.patient.weight,convertToStandardUnit)),entryMinute:minute},'edit-'+session);}
    catch(error){report(error);return false;}
  };
  const openEdit=e=>{history.current.endGroup();setEditing(e.id);setMinute(e.time);setEditSession(++nextSession.current);
    panelRef.current?.scrollIntoView({block:'start',behavior:'smooth'});};
  const remove=id=>{try{if(accept({events:deleteCondition(latest.current.events,id)}))done();}catch(error){report(error);}};
  const undo=direction=>{done();setEditSession(++nextSession.current);
    const s=direction==='undo'?history.current.undo():history.current.redo();latest.current=s;setState(s);setPatientDraft(s.patient);setMinute(s.entryMinute??minute);setInputError('');setCurrentScenarioId(null);};
  const saveScenario=(id=null,name=null)=>{
    const data=validateSimpleSnapshot(latest.current);delete data.savedScenarios;delete data.savedTraces;
    const entry={id:id??newEventId(),name:name||state.drug+' '+start,timestamp:Date.now(),data};
    if(accept({savedScenarios:id?state.savedScenarios.map(s=>s.id===id?{...entry,name:s.name}:s):[entry,...state.savedScenarios]})){
      scenarioBaseline.current=caseFingerprint(latest.current);setCurrentScenarioId(entry.id);
    }
  };
  const restore=(d,preserveLibrary=true)=>{const loaded=hydrate(d);
    if(accept({...loaded,savedScenarios:preserveLibrary?state.savedScenarios:loaded.savedScenarios,savedTraces:preserveLibrary?state.savedTraces:loaded.savedTraces})){done();setEditSession(++nextSession.current);setMinute(loaded.entryMinute);setPatientDraft(loaded.patient);setCurrentScenarioId(null);return true;}return false;};
  const loadScenario=s=>{try{if(restore(s.data)){scenarioBaseline.current=caseFingerprint(latest.current);setCurrentScenarioId(s.id);}}catch{setInputError('savedStateInvalid');}};
  const exportData=()=>{
    const payload={current:latest.current,original:localStorage.getItem(BACKUP_KEY)??localStorage.getItem(LEGACY_KEY)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='opioid-sim-backup.json';link.click();URL.revokeObjectURL(url);
  };
  const restoreOriginal=()=>{try{const raw=localStorage.getItem(BACKUP_KEY)??localStorage.getItem(LEGACY_KEY);if(!raw)throw new Error();restore(JSON.parse(raw),false);}catch{setInputError('savedStateInvalid');}};
  const importBackup=async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{if(file.size>10*1024*1024)throw new Error();const payload=JSON.parse(await file.text());restore(payload.current??payload,false);}
    catch{setInputError('savedStateInvalid');}
  };
  const visibleTraces=showTraces?state.savedTraces.filter(tr=>tr.drug===state.drug&&tr.calculationVersion===CALCULATION_VERSION):[];
  return <div className="simple-app">
    <TopBar t={t} i18n={i18n} showRanges={showRanges} setShowRanges={setShowRanges} patient={patientDraft} setPatient={updatePatient}
      onPatientComplete={completePatient} autoFillStats={state.autoFillStats} setAutoFillStats={value=>{
        const patient=value?{...state.patient,...estimateGrowth(state.patient.age,state.patient.gender)}:state.patient;
        if(accept({autoFillStats:value,patient}))setPatientDraft(patient);
      }}
      activeParams={getModelRequirements(state.drug,model)} savedScenarios={state.savedScenarios} saveScenario={saveScenario}
      loadScenario={loadScenario} deleteScenario={id=>{if(accept({savedScenarios:state.savedScenarios.filter(s=>s.id!==id)})&&id===currentScenarioId)setCurrentScenarioId(null);}}
      currentScenarioId={currentScenarioId} isModified={currentScenarioId!=null&&caseFingerprint(state)!==scenarioBaseline.current}
      lastSavedAt={lastSavedAt} isDark={isDark} setIsDark={setIsDark}/>
    <main className="simple-main">
      {(inputError||storageError)&&<div role="alert" className="error-banner">{[inputError,storageError].filter(Boolean).map(key=><p key={key}>{t(key)}</p>)}</div>}
      <div ref={panelRef} className="input-anchor"><SimpleDosePanel drug={state.drug} onDrug={drug=>{done();accept({drug});}}
        patient={state.patient} patientValid={isValidPatient(patientDraft)&&JSON.stringify(patientDraft)===JSON.stringify(state.patient)}
        events={state.events} minute={minute} onMinute={setMinute} startTime={start} onNow={entryNow}
        editingEvent={editingEvent} editSession={editSession} onAdd={add} onEdit={edit} onDone={done} t={t}/></div>
      <div className="undo-strip"><button type="button" className="quiet-button" disabled={!history.current.canUndo} onClick={()=>undo('undo')}>{t('simpleUndo')}</button>
        <button type="button" className="quiet-button" disabled={!history.current.canRedo} onClick={()=>undo('redo')}>{t('simpleRedo')}</button></div>
      {(model.includes('Scaled')||(state.drug==='Hydromorphone'&&model==='Standard (Adult)'))&&<p className="muted">{t('unsourcedModelNote')}</p>}
      {state.patient.age<12&&(model.includes('Adult')||model.includes('General-purpose'))&&<p className="muted">{t('populationLimitNote')}</p>}
      {params?.ke0===0&&<p className="muted">{t('ceUnavailable')}</p>}
      <SimpleGraph data={data} drug={state.drug} startTime={start} currentMinute={currentMinute} range={{start:state.plotStart,end:state.simDuration}}
        onRange={range=>accept({plotStart:range.start,simDuration:range.end,manualRange:true},'range')} showRanges={showRanges}
        thresholds={{...THERAPEUTIC_RANGES[state.drug],...state.therapeuticOverrides[state.drug]}} savedTraces={visibleTraces} t={t}/>
      {state.events.some(e=>e.drug===state.drug&&(e.time<state.plotStart||e.time>state.simDuration))&&<p className="muted">{t('simpleOutsideRange')}</p>}
      <SimpleHistory events={state.events} drug={state.drug} patient={state.patient} startTime={start} onEdit={openEdit} onDelete={remove} editingId={editing} t={t}/>
      <details className="advanced-panel"><summary>{t('simpleDetails')}</summary><div className="advanced-content">
        <label>{t('model')}<select aria-label={t('model')} value={model} onChange={e=>accept({modelByDrug:{...state.modelByDrug,[state.drug]:e.target.value}})}>
          {AVAILABLE_MODELS[state.drug].map(m=><option key={m}>{m}</option>)}</select></label>
        <button className="quiet-button" onClick={()=>setReferenceOpen(true)}>{t('viewLiteratureLabel')}</button>
        {params&&<dl className="parameter-list">{['V1','V2','V3','Cl','Q2','Q3','ke0'].map(k=><div key={k}><dt>{k}</dt><dd>{Number(params[k]).toPrecision(4)}</dd></div>)}</dl>}
        <div className="advanced-actions"><button className="quiet-button" onClick={exportData}>{t('simpleExport')}</button>
          <label className="quiet-button">{t('simpleImport')}<input type="file" accept=".json,application/json" onChange={importBackup} className="backup-file"/></label>
          <button className="quiet-button" onClick={restoreOriginal}>{t('simpleRestoreOriginal')}</button>
          <button className="quiet-button" onClick={()=>accept({savedTraces:[...state.savedTraces,{id:newEventId(),name:state.drug+' · '+model,drug:state.drug,
            color:DRUG_COLORS[state.drug].ce,calculationVersion:CALCULATION_VERSION,data:structuredClone(data)}]})}>{t('simpleSaveCurve')}</button></div>
        {!!state.savedTraces.length&&<label><input type="checkbox" checked={showTraces} onChange={e=>setShowTraces(e.target.checked)}/>{t('simpleShowCurves')} ({state.savedTraces.length})</label>}
        {legacyStreams(state.events,state.drug)&&<p>{t('simpleLegacyStreams')}</p>}
        <p className="muted">{t('simpleStorageNote')}</p>
        <button className="quiet-button" onClick={()=>restore(freshCase())}>{t('simpleNewCase')}</button>
      </div></details>
      <TherapeuticReferenceModal open={referenceOpen} onClose={()=>setReferenceOpen(false)} drug={state.drug} t={t}/>
    </main>
  </div>;
}
