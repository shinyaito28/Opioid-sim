import {Activity,Eye,EyeOff,Sun,Moon} from 'lucide-react';
import PatientChip from './PatientChip';
import ScenarioMenu from './ScenarioMenu';

export default function TopBar({t,i18n,showRanges,setShowRanges,patient,setPatient,onPatientComplete,autoFillStats,setAutoFillStats,activeParams,
  savedScenarios,saveScenario,loadScenario,deleteScenario,currentScenarioId,isModified,lastSavedAt,isDark,setIsDark}) {
  const savedLabel=lastSavedAt?new Date(lastSavedAt).toLocaleTimeString(i18n.language,{hour:'2-digit',minute:'2-digit'}):null;
  return <header className="app-topbar"><div className="topbar-inner">
    <div className="topbar-brand"><Activity size={20} aria-hidden="true"/><h1>{t('appTitle')}</h1></div>
    <div className="topbar-tools">
      <PatientChip patient={patient} setPatient={setPatient} onComplete={onPatientComplete} autoFillStats={autoFillStats}
        setAutoFillStats={setAutoFillStats} activeParams={activeParams} t={t}/>
      <ScenarioMenu savedScenarios={savedScenarios} saveScenario={saveScenario} loadScenario={loadScenario} deleteScenario={deleteScenario}
        currentScenarioId={currentScenarioId} isModified={isModified} t={t}/>
      {savedLabel&&<span className="topbar-saved" title={t('autoSavedTooltip')}>{t('autoSavedAt',{time:savedLabel})}</span>}
      <div className="topbar-language" role="group" aria-label={t('language')}>
        <button type="button" onClick={()=>i18n.changeLanguage('en')} data-testid="language-en" aria-pressed={i18n.language==='en'} lang="en">EN</button>
        <button type="button" onClick={()=>i18n.changeLanguage('ja')} data-testid="language-ja" aria-pressed={i18n.language==='ja'} lang="ja">日本語</button>
      </div>
      <button type="button" className="topbar-button icon-button" onClick={()=>setIsDark(value=>!value)} title={t(isDark?'lightMode':'darkMode')}
        aria-label={t(isDark?'lightMode':'darkMode')}>{isDark?<Sun size={18}/>:<Moon size={18}/>}</button>
      <button type="button" className="topbar-button icon-button" onClick={()=>setShowRanges(!showRanges)} aria-pressed={showRanges}
        aria-label={t(showRanges?'hideRanges':'showRanges')} title={t(showRanges?'hideRanges':'showRanges')}>{showRanges?<Eye size={18}/>:<EyeOff size={18}/>}</button>
    </div>
  </div></header>;
}
