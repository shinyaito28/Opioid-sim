import {useState} from 'react';
import {User,ChevronDown} from 'lucide-react';
import {isValidPatient} from '../lib/validation';
import ViewportDialog from './ViewportDialog';

export function PatientFields({patient,setPatient,autoFillStats,setAutoFillStats,activeParams=[],t}) {
  const unused=field=>activeParams.length>0&&!activeParams.includes(field);
  const update=(field,value)=>setPatient({...patient,[field]:value});
  return <>
    <label className="patient-auto"><input type="checkbox" checked={autoFillStats} onChange={e=>setAutoFillStats(e.target.checked)}/>{t('autoAdjust')}</label>
    <div className="patient-grid">{['age','gender','weight','height'].map(field=><label key={field} className={unused(field)?'patient-field unused-field':'patient-field'}>
      <span>{t(field)} {unused(field)&&<small>({t('paramUnused')})</small>} {autoFillStats&&['weight','height'].includes(field)&&<small>{t('graphAuto')}</small>}</span>
      {field==='gender'?<select value={patient.gender} onChange={e=>update(field,e.target.value)}><option value="male">{t('male')}</option><option value="female">{t('female')}</option></select>:
        <input type="number" inputMode="decimal" min="0" value={Number.isFinite(patient[field])?patient[field]:''} onChange={e=>update(field,parseFloat(e.target.value))}/>}
    </label>)}</div>
    {activeParams.length>0&&activeParams.length<4&&<p className="muted patient-model-note">{t('paramUnusedNote',{active:activeParams.map(field=>t(field)).join(t('listSeparator'))})}</p>}
  </>;
}

export default function PatientChip({patient,setPatient,onComplete,autoFillStats,setAutoFillStats,activeParams=[],t}) {
  const [open,setOpen]=useState(false),valid=isValidPatient(patient);
  const number=value=>Number.isFinite(value)?value:'—';
  const summary=t('patientSummary',{age:number(patient.age),sex:t(patient.gender==='female'?'sexShortFemale':'sexShortMale'),weight:number(patient.weight),height:number(patient.height)});
  return <div className="patient-menu">
    <button type="button" className="topbar-button patient-trigger" data-testid="patient-toggle" aria-expanded={open} aria-haspopup="dialog"
      title={t('patientSettings')} onClick={()=>setOpen(true)}><User size={16} aria-hidden="true"/><span>{summary}</span><ChevronDown size={14} aria-hidden="true"/></button>
    <ViewportDialog open={open} onClose={()=>setOpen(false)} title={t('patientSettings')} t={t} width={380} testId="patient-popover">
      <PatientFields patient={patient} setPatient={setPatient} autoFillStats={autoFillStats} setAutoFillStats={setAutoFillStats} activeParams={activeParams} t={t}/>
      {!valid&&<p className="graph-axis-note" role="status">{t('patientInvalid')}</p>}
      <button type="button" className="primary-button patient-done" disabled={!valid} onClick={()=>{onComplete?.();setOpen(false);}}>{t('simpleDone')}</button>
    </ViewportDialog>
  </div>;
}
