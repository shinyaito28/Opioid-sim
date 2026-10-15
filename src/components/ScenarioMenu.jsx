import {useState} from 'react';
import {FolderOpen,Save,Download,Trash2,ChevronDown,SaveAll} from 'lucide-react';
import ViewportDialog from './ViewportDialog';

export function SavedCaseList({savedScenarios,currentScenarioId,isModified,onLoad,deleteScenario,t}) {
  if(!savedScenarios.length)return <p className="muted">{t('noSavedCases')}</p>;
  return <div className="saved-case-list">{savedScenarios.map(s=><div key={s.id} className={'saved-case-row '+(s.id===currentScenarioId?'current-case':'')}>
    <div className="saved-case-description"><h3>{s.name}</h3>
      {s.id===currentScenarioId&&<p className="case-current">{t(isModified?'unsavedChanges':'currentScenario')}</p>}
      <p className="case-meta">{t('caseEventCount',{count:s.data.events.length})} · {s.data.modelByDrug?.[s.data.drug]||s.data.model||t('entryDrug'+s.data.drug,{defaultValue:s.data.drug})}</p>
    </div>
    <div className="saved-case-actions"><button type="button" className="quiet-button" onClick={()=>onLoad(s)}><Download size={15} aria-hidden="true"/>{t('load')}</button>
      <button type="button" className="case-delete" aria-label={t('deleteCase',{name:s.name})} onClick={()=>deleteScenario(s.id)}><Trash2 size={18} aria-hidden="true"/></button></div>
  </div>)}</div>;
}

export default function ScenarioMenu({savedScenarios,saveScenario,loadScenario,deleteScenario,currentScenarioId,isModified,t}) {
  const [open,setOpen]=useState(false),[name,setName]=useState('');
  const save=event=>{event.preventDefault();saveScenario(null,name.trim()||null);setName('');};
  return <div className="case-menu">
    <button type="button" className="topbar-button" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(true)} title={t('saveScenarioTooltip')}>
      <FolderOpen size={16} aria-hidden="true"/><span>{t('savedCases')}{savedScenarios.length>0?' ('+savedScenarios.length+')':''}</span><ChevronDown size={14} aria-hidden="true"/>
    </button>
    <ViewportDialog open={open} onClose={()=>setOpen(false)} title={t('savedCases')} t={t} width={460} testId="saved-cases-dialog">
      <form className="case-save-form" onSubmit={save}>
        <label>{t('caseName')}<input value={name} onChange={e=>setName(e.target.value)} placeholder={t('scenarioNamePrompt')} autoComplete="off"/></label>
        <button type="submit" className="quiet-button"><Save size={16} aria-hidden="true"/>{t('saveCase')}</button>
      </form>
      {currentScenarioId!=null&&<button type="button" className="quiet-button case-overwrite" onClick={()=>saveScenario(currentScenarioId)} title={t('overwriteSaveTooltip')}>
        <SaveAll size={16} aria-hidden="true"/>{t(isModified?'overwriteSaveWithChanges':'overwriteSave')}</button>}
      <SavedCaseList savedScenarios={savedScenarios} currentScenarioId={currentScenarioId} isModified={isModified}
        onLoad={s=>{loadScenario(s);setOpen(false);}} deleteScenario={deleteScenario} t={t}/>
    </ViewportDialog>
  </div>;
}
