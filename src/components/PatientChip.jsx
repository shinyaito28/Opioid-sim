import { useEffect, useRef } from 'react';
import { User, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import { useCollapsibleBar } from '../hooks/useCollapsibleBar';

// Compact patient summary chip with click-to-expand form.
// Collapsed: "45y M 70kg 170cm" — fits in a 200px wide button.
// Expanded: 2x2 grid of inputs (Age, Gender, Weight, Height) + auto-fill toggle.
// Auto-collapse fires 5s after the last interaction once weight & height are valid.
// Phase 5-N: activeParams (model requirements) is taken from App.jsx so each
// input field can render an "unused" hint when the current drug/model doesn't
// use that parameter. Empty array means "no model selected" — don't gray fields.
export default function PatientChip({ patient, setPatient, autoFillStats, setAutoFillStats, activeParams = [], t }) {
  const isUnused = (p) => activeParams.length > 0 && !activeParams.includes(p);
  const unusedTag = (
    <span className="ml-1 text-[9px] font-normal normal-case text-slate-400 dark:text-slate-500">
      ({t('paramUnused')})
    </span>
  );
  const fieldCls = (p) =>
    `w-full border rounded p-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 ${
      isUnused(p)
        ? 'border-slate-200 dark:border-slate-700 opacity-50'
        : 'border-slate-300 dark:border-slate-600'
    }`;
  const valid = patient.weight > 0 && patient.height > 0 && patient.age >= 0;
  const { mode, toggle, collapse, bumpInteraction } = useCollapsibleBar({ canCollapse: valid });
  const popoverRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (mode !== 'expanded') return undefined;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) collapse();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mode, collapse]);

  const summary = `${patient.age}y ${patient.gender === 'female' ? 'F' : 'M'} ${patient.weight}kg ${patient.height}cm`;

  const update = (field, value) => {
    setPatient({ ...patient, [field]: value });
    bumpInteraction();
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 bg-slate-700/80 hover:bg-slate-600 text-slate-100 px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors"
        title={t('patientSettings')}
      >
        <User className="w-3 h-3" />
        <span className="font-medium">{summary}</span>
        {mode === 'expanded' ? <ChevronUp className="w-3 h-3 opacity-70" /> : <ChevronDown className="w-3 h-3 opacity-70" />}
      </button>

      {mode === 'expanded' && (
        <div
          className="absolute top-full mt-1 right-0 sm:right-auto sm:left-0 glass shadow-xl border border-slate-300 dark:border-slate-600 rounded-lg p-3 z-50 w-72 text-slate-800 dark:text-slate-100"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <User className="w-4 h-4" />
              <h3 className="font-bold text-sm">{t('patientSettings')}</h3>
            </div>
            <label className="flex items-center gap-1 text-[10px] text-blue-700 dark:text-blue-300 cursor-pointer bg-blue-50 dark:bg-blue-900/40 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition">
              <Wand2 className="w-3 h-3" />
              <input
                type="checkbox"
                checked={autoFillStats}
                onChange={(e) => { setAutoFillStats(e.target.checked); bumpInteraction(); }}
                className="accent-blue-600 w-3 h-3"
              />
              <span>{t('autoAdjust')}</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <label className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
                {t('age')}{isUnused('age') && unusedTag}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={patient.age}
                onChange={(e) => update('age', Math.max(0, Number(e.target.value)))}
                className={fieldCls('age')}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
                {t('gender')}{isUnused('gender') && unusedTag}
              </label>
              <select
                value={patient.gender}
                onChange={(e) => update('gender', e.target.value)}
                className={fieldCls('gender')}
              >
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold flex justify-between">
                <span>{t('weight')}{isUnused('weight') && unusedTag}</span>
                {autoFillStats && <span className="text-[9px] opacity-60">Auto</span>}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={patient.weight}
                onChange={(e) => update('weight', Math.max(0, Number(e.target.value)))}
                className={fieldCls('weight')}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold flex justify-between">
                <span>{t('height')}{isUnused('height') && unusedTag}</span>
                {autoFillStats && <span className="text-[9px] opacity-60">Auto</span>}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={patient.height}
                onChange={(e) => update('height', Math.max(0, Number(e.target.value)))}
                className={fieldCls('height')}
              />
            </div>
          </div>

          {/* Phase 5-N: contextual hint when at least one parameter is unused.
              Tells the clinician explicitly that the greyed-out fields are
              ignored by the currently selected PK model. */}
          {activeParams.length > 0 && activeParams.length < 4 && (
            <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 italic leading-tight">
              {t('paramUnusedNote', { active: activeParams.join(', ') })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
