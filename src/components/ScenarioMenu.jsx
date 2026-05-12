import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Save, Download, Trash2, ChevronDown, ChevronUp, SaveAll } from 'lucide-react';

// Compact saved-scenarios menu in the top bar.
// Closed: "📁 Cases (3)" button.
// Open: dropdown with "+ Save current case" then list of scenarios with load/delete.
// Phase 5-L-1: when a named scenario is currently loaded (currentScenarioId set),
// an additional "Overwrite" button is shown so the user can update that entry in
// place instead of always creating a new row. isModified flips the overwrite
// button into an emphasised "Save changes" state.
export default function ScenarioMenu({
  savedScenarios, saveScenario, loadScenario, deleteScenario,
  currentScenarioId, isModified,
  t,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const onSave = () => {
    // Optional custom name; cancel keeps the auto-name.
    const name = window.prompt(t('scenarioNamePrompt'), '');
    saveScenario(null, name && name.trim() ? name.trim() : null);
  };
  const onOverwrite = () => {
    if (currentScenarioId == null) return;
    saveScenario(currentScenarioId);
  };
  const onLoad = (s) => { loadScenario(s); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-slate-700/80 hover:bg-slate-600 text-slate-100 px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors"
        title={t('saveScenarioTooltip')}
      >
        <FolderOpen className="w-3 h-3" />
        <span className="font-medium">{t('savedCases')}</span>
        {savedScenarios.length > 0 && (
          <span className="bg-indigo-500/80 text-white text-[10px] rounded-full px-1.5 leading-tight">
            {savedScenarios.length}
          </span>
        )}
        {open ? <ChevronUp className="w-3 h-3 opacity-70" /> : <ChevronDown className="w-3 h-3 opacity-70" />}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 glass shadow-xl border border-slate-300 dark:border-slate-600 rounded-lg z-50 w-80 max-h-[60vh] overflow-y-auto text-slate-800 dark:text-slate-100">
          {currentScenarioId != null && (
            <button
              onClick={onOverwrite}
              className={`w-full flex items-center gap-2 p-2.5 text-sm font-bold border-b border-slate-200 dark:border-slate-700 transition ${isModified
                ? 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/40'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/40'}`}
              title={t('overwriteSaveTooltip')}
            >
              <SaveAll className="w-4 h-4" />
              <span>{isModified ? t('overwriteSaveWithChanges') : t('overwriteSave')}</span>
            </button>
          )}
          <button
            onClick={onSave}
            className="w-full flex items-center gap-2 p-2.5 text-sm font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border-b border-slate-200 dark:border-slate-700 transition"
          >
            <Save className="w-4 h-4" />
            <span>{t('saveCase')}</span>
          </button>

          {savedScenarios.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 italic text-center">
              {t('noHistory')}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {savedScenarios.map((s) => (
                <div
                  key={s.id}
                  className={`p-2 px-3 flex justify-between items-center text-sm group ${
                    s.id === currentScenarioId
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-l-2 border-indigo-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                      {s.name}
                      {s.id === currentScenarioId && (
                        <span className="ml-1 text-[10px] font-normal text-indigo-600 dark:text-indigo-300">
                          {isModified ? `· ${t('unsavedChanges')}` : `· ${t('currentScenario')}`}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 truncate">
                      {s.data.events.length} events · {s.data.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onLoad(s)}
                      className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-xs"
                    >
                      <Download className="w-3 h-3" />
                      {t('load')}
                    </button>
                    <button
                      onClick={() => deleteScenario(s.id)}
                      className="text-slate-400 dark:text-slate-500 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/40"
                      title={t('deleteTooltip')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
