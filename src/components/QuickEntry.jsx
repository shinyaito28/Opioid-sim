import { useState, useEffect, useRef } from 'react';
import { Syringe, Plus, AlertTriangle, Clock, Minus, RotateCcw } from 'lucide-react';

const TYPE_BOLUS = 'bolus';
const TYPE_INFUSION = 'infusion';

// Per-drug bolus stepper increment — mirrors the "round numbers anesthesiologists actually use"
// (Fent ±25 mcg, Mor ±1 mg, HM ±0.2 mg, Sufenta ±5 mcg, Propofol ±10 mg etc.).
const DRUG_DOSE_STEPS = {
  Fentanyl:      25,
  Remifentanil:  25,
  Morphine:      1,
  Hydromorphone: 0.2,
  Methadone:     0.5,
  Sufentanil:    5,
  Propofol:      10,
  Remimazolam:   1,  // typical induction bolus 5-12 mg → ±1 mg increments
  Ketamine:      5,  // typical sub-anesthetic to induction range 25-150 mg → ±5 mg increments
  Dexmedetomidine: 10, // typical loading bolus increments — 70 kg adult = 1 mcg/kg ≈ 70 mcg
};

// Helpers (mirrors App.jsx top-level helpers)
const minutesToTimeStr = (minutes, startStr) => {
  if (!startStr) return '00:00';
  const [sh, sm] = startStr.split(':').map(Number);
  const totalMin = sh * 60 + sm + Math.round(minutes);
  let h = Math.floor(totalMin / 60) % 24;
  if (h < 0) h += 24;
  let m = Math.floor(totalMin % 60);
  if (m < 0) m += 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const timeStrToMinutes = (timeStr, startStr) => {
  if (!timeStr || !startStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const [sh, sm] = startStr.split(':').map(Number);
  return (h * 60 + m) - (sh * 60 + sm);
};

const roundStep = (val, step) => {
  if (step >= 1) return Math.round(val);
  // Avoid floating-point ugliness like 0.30000000004 mg
  const decimals = String(step).split('.')[1]?.length || 0;
  return parseFloat(val.toFixed(decimals));
};

export default function QuickEntry({
  drug, setDrug, patient, isClockMode, startTime, currentSimMinutes,
  drugList, drugUnits, drugShortNames, clinicalDefaults,
  lastDoseByDrug,
  quickAddBolus, quickAddInfusion,
  t,
}) {
  const [type, setType] = useState(TYPE_BOLUS);
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [unit, setUnit] = useState(drugUnits[drug]?.[0] || 'mcg/kg/hr');
  const [duration, setDuration] = useState(60);
  const [isInfinite, setIsInfinite] = useState(true);
  // Time the next event will be added at, in sim minutes from startTime (clock mode)
  // or sim minutes from t=0 (minute mode). Adjustable via −1m / +1m / direct edit / Now.
  const [selectedTimeMin, setSelectedTimeMin] = useState(0);

  // Track whether selectedTimeMin should auto-track the current clock — only true until the
  // user starts editing time manually, then it freezes. Returns to true on Now.
  const trackNowRef = useRef(true);

  // Pre-populate amount/rate/unit/duration from the per-drug last entry on drug change.
  useEffect(() => {
    const last = lastDoseByDrug?.[drug];
    if (last?.bolusAmount != null) setAmount(String(last.bolusAmount));
    if (last?.infusionRate != null) setRate(String(last.infusionRate));
    if (last?.infusionUnit && drugUnits[drug]?.includes(last.infusionUnit)) {
      setUnit(last.infusionUnit);
    } else {
      setUnit(drugUnits[drug]?.[0] || 'mcg/kg/hr');
    }
    if (last?.infusionDuration != null) setDuration(last.infusionDuration);
    if (typeof last?.isInfinite === 'boolean') setIsInfinite(last.isInfinite);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drug]);

  // Keep selectedTimeMin tracking the live clock until user edits it.
  useEffect(() => {
    if (!trackNowRef.current) return;
    setSelectedTimeMin(isClockMode && currentSimMinutes != null ? currentSimMinutes : 0);
  }, [currentSimMinutes, isClockMode]);

  const valid = patient.weight > 0 && patient.height > 0;
  const doseUnit = clinicalDefaults[drug]?.unit || 'mcg';
  const valEntered = type === TYPE_BOLUS
    ? !!amount && parseFloat(amount) > 0
    : !!rate && parseFloat(rate) > 0;
  const canAdd = valid && valEntered;
  const step = DRUG_DOSE_STEPS[drug] ?? 1;

  const stepAmount = (delta) => {
    const cur = parseFloat(amount) || 0;
    const next = Math.max(0, cur + delta);
    setAmount(String(roundStep(next, Math.abs(delta))));
  };

  const shiftTime = (delta) => {
    trackNowRef.current = false;
    setSelectedTimeMin((prev) => prev + delta);
  };

  const resetToNow = () => {
    trackNowRef.current = true;
    setSelectedTimeMin(isClockMode && currentSimMinutes != null ? currentSimMinutes : 0);
  };

  const onTimeInputChange = (val) => {
    trackNowRef.current = false;
    if (isClockMode) {
      setSelectedTimeMin(timeStrToMinutes(val, startTime));
    } else {
      const n = parseFloat(val);
      if (!Number.isNaN(n)) setSelectedTimeMin(n);
    }
  };

  const submit = () => {
    if (!canAdd) return;
    if (type === TYPE_BOLUS) {
      quickAddBolus(drug, parseFloat(amount), selectedTimeMin);
    } else {
      quickAddInfusion(drug, parseFloat(rate), unit, selectedTimeMin, parseFloat(duration), isInfinite);
    }
    // Don't clear amount/rate — anesthesiologist will likely repeat the same dose; resume tracking Now.
    resetToNow();
  };

  // Format the time display
  const timeDisplay = isClockMode
    ? minutesToTimeStr(selectedTimeMin, startTime)
    : String(selectedTimeMin);
  const timeOffsetLabel = isClockMode && currentSimMinutes != null
    ? (() => {
        const diff = selectedTimeMin - currentSimMinutes;
        if (diff === 0) return t('now');
        if (diff < 0) return `${diff}m`;
        return `+${diff}m`;
      })()
    : null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 sm:p-3 space-y-2">
      {!valid && (
        <div className="px-3 py-1.5 bg-red-100 border border-red-300 text-red-800 text-xs rounded flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>体重・身長が無効です。上の患者情報を更新してください。</span>
        </div>
      )}

      {/* Drug chips */}
      <div className="flex flex-wrap gap-1.5">
        {drugList.map((d) => {
          const isActive = d === drug;
          return (
            <button
              key={d}
              onClick={() => setDrug(d)}
              className={`px-2.5 py-1 text-xs font-bold rounded transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {drugShortNames[d] || d}
            </button>
          );
        })}
      </div>

      {/* Main row: type + dose + time + Add */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Type toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-700 rounded p-0.5">
          <button
            onClick={() => setType(TYPE_BOLUS)}
            className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 ${
              type === TYPE_BOLUS ? 'bg-purple-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Syringe className="w-3 h-3" />
            Bolus
          </button>
          <button
            onClick={() => setType(TYPE_INFUSION)}
            className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 ${
              type === TYPE_INFUSION ? 'bg-orange-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            Inf
          </button>
        </div>

        {/* Dose / rate input */}
        {type === TYPE_BOLUS ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => stepAmount(-step)}
              disabled={!valid || (parseFloat(amount) || 0) <= 0}
              className="w-7 h-8 flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-700 rounded disabled:bg-slate-100 dark:bg-slate-700 disabled:text-slate-400 dark:text-slate-500"
              title={`−${step}${doseUnit}`}
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canAdd) submit(); }}
              placeholder={t('dose')}
              className="w-20 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm font-bold text-center bg-purple-50 text-purple-900 focus:ring-2 focus:ring-purple-300 focus:outline-none"
              disabled={!valid}
            />
            <button
              onClick={() => stepAmount(step)}
              disabled={!valid}
              className="w-7 h-8 flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-700 rounded disabled:bg-slate-100 dark:bg-slate-700 disabled:text-slate-400 dark:text-slate-500"
              title={`+${step}${doseUnit}`}
            >
              <Plus className="w-3 h-3" />
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 font-mono ml-0.5">{doseUnit}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canAdd) submit(); }}
              placeholder={t('rate')}
              className="w-20 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm font-bold text-center bg-orange-50 text-orange-900 focus:ring-2 focus:ring-orange-300 focus:outline-none"
              disabled={!valid}
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 rounded px-1 py-1.5 text-xs"
            >
              {drugUnits[drug]?.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={isInfinite}
                onChange={(e) => setIsInfinite(e.target.checked)}
                className="accent-orange-600"
              />
              <span>∞</span>
            </label>
            {!isInfinite && (
              <input
                type="number"
                inputMode="decimal"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder={t('summaryMin')}
                className="w-16 border border-slate-300 dark:border-slate-600 rounded px-1 py-1.5 text-sm text-center"
              />
            )}
          </div>
        )}

        {/* Time controls + Add */}
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          <button
            onClick={() => shiftTime(-1)}
            className="px-2 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded"
            title="時刻を1分前にシフト"
          >
            −1m
          </button>
          {isClockMode ? (
            <input
              type="time"
              value={timeDisplay}
              onChange={(e) => onTimeInputChange(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 rounded px-1 py-1 text-xs font-mono"
            />
          ) : (
            <input
              type="number"
              inputMode="decimal"
              value={timeDisplay}
              onChange={(e) => onTimeInputChange(e.target.value)}
              className="w-16 border border-slate-300 dark:border-slate-600 rounded px-1 py-1.5 text-xs text-center font-mono"
              title="t (min)"
            />
          )}
          {!isClockMode && <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">min</span>}
          {timeOffsetLabel && timeOffsetLabel !== t('now') && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 font-mono">({timeOffsetLabel})</span>
          )}
          <button
            onClick={() => shiftTime(1)}
            className="px-2 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded"
            title="時刻を1分後にシフト"
          >
            +1m
          </button>
          {isClockMode && (
            <button
              onClick={resetToNow}
              className="px-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded flex items-center gap-1"
              title="現在時刻にリセット"
            >
              <RotateCcw className="w-3 h-3" />
              {t('now')}
            </button>
          )}

          <button
            onClick={submit}
            disabled={!canAdd}
            className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
