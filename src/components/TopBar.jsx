import { Activity, Eye, EyeOff } from 'lucide-react';
import PatientChip from './PatientChip';
import ScenarioMenu from './ScenarioMenu';

// Sticky top bar — replaces the old `<header>` block.
// Contains brand, patient chip (click to expand), scenarios menu, language toggle, ranges toggle.
export default function TopBar({
  t, i18n,
  showRanges, setShowRanges,
  patient, setPatient, autoFillStats, setAutoFillStats,
  savedScenarios, saveScenario, loadScenario, deleteScenario,
}) {
  return (
    <header
      className="bg-slate-800 text-white shadow-md sticky top-0 z-30"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: '0.5rem',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 mr-auto">
          <Activity className="h-5 w-5 text-blue-400" />
          <h1 className="text-base sm:text-lg font-bold whitespace-nowrap">{t('appTitle')}</h1>
        </div>

        <PatientChip
          patient={patient}
          setPatient={setPatient}
          autoFillStats={autoFillStats}
          setAutoFillStats={setAutoFillStats}
          t={t}
        />

        <ScenarioMenu
          savedScenarios={savedScenarios}
          saveScenario={saveScenario}
          loadScenario={loadScenario}
          deleteScenario={deleteScenario}
          t={t}
        />

        <div className="flex bg-slate-700 rounded p-0.5 gap-0.5">
          <button
            onClick={() => i18n.changeLanguage('en')}
            className={`px-2 py-0.5 text-xs rounded ${i18n.language === 'en' ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
          >
            EN
          </button>
          <button
            onClick={() => i18n.changeLanguage('ja')}
            className={`px-2 py-0.5 text-xs rounded ${i18n.language === 'ja' ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
          >
            JP
          </button>
        </div>

        <button
          onClick={() => setShowRanges(!showRanges)}
          className="text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded flex items-center gap-1"
        >
          {showRanges ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span className="hidden sm:inline">{t('ranges')}</span>
        </button>

        <div className="text-[10px] bg-red-900/50 text-red-200 px-2 py-1 rounded border border-red-800 hidden md:block">
          {t('forResearchOnly')}
        </div>
      </div>
    </header>
  );
}
