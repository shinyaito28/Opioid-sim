import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Save, Download, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

// Compact saved-scenarios menu in the top bar.
// Closed: "📁 Cases (3)" button.
// Open: dropdown with "+ Save current case" then list of scenarios with load/delete.
export default function ScenarioMenu({ savedScenarios, saveScenario, loadScenario, deleteScenario, t }) {
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

  const onSave = () => { saveScenario(); /* keep open so user can confirm */ };
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
        <div className="absolute top-full mt-1 right-0 glass shadow-xl border border-slate-300 rounded-lg z-50 w-80 max-h-[60vh] overflow-y-auto text-slate-800">
          <button
            onClick={onSave}
            className="w-full flex items-center gap-2 p-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50 border-b border-slate-200 transition"
          >
            <Save className="w-4 h-4" />
            <span>{t('saveCase')}</span>
          </button>

          {savedScenarios.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 italic text-center">
              {t('noHistory')}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {savedScenarios.map((s) => (
                <div key={s.id} className="p-2 px-3 flex justify-between items-center text-sm hover:bg-slate-50 group">
                  <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <span className="font-bold text-slate-700 truncate">{s.name}</span>
                    <span className="text-[10px] text-slate-500 truncate">
                      {s.data.events.length} events · {s.data.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onLoad(s)}
                      className="flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 text-xs"
                    >
                      <Download className="w-3 h-3" />
                      {t('load')}
                    </button>
                    <button
                      onClick={() => deleteScenario(s.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
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
