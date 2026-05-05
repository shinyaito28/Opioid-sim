import { useState, useEffect, useRef } from 'react';
import { Syringe, Plus, Minus, Clock, X, Trash2, Check, Edit2 } from 'lucide-react';

// Per-drug bolus stepper increment — mirrors QuickEntry's table.
const DRUG_DOSE_STEPS = {
  Fentanyl:        25,
  Remifentanil:    25,
  Morphine:         1,
  Hydromorphone:    0.2,
  Methadone:        0.5,
  Sufentanil:       5,
  Propofol:        10,
  Remimazolam:      1,
  Ketamine:         5,
  Dexmedetomidine: 10,
};

const minutesToTime = (minutes, startStr) => {
  if (!startStr) return '00:00';
  const [sh, sm] = startStr.split(':').map(Number);
  const totalMin = sh * 60 + sm + Math.round(minutes);
  let h = Math.floor(totalMin / 60) % 24;
  if (h < 0) h += 24;
  let m = Math.floor(totalMin % 60);
  if (m < 0) m += 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const roundStep = (val, step) => {
  if (step >= 1) return Math.round(val);
  const decimals = String(step).split('.')[1]?.length || 0;
  return parseFloat(val.toFixed(decimals));
};

// Floating in-chart popover for adding OR editing a single bolus or infusion event at a
// clicked position. When editingEvent is null the popover is in Add mode and calls
// quickAddBolus / quickAddInfusion. When editingEvent is supplied the popover pre-fills
// from the event and shows Update / Delete buttons that drive onUpdate / onDelete.
export default function ChartEventPopover({
  open,
  onClose,
  position,            // { x, y } — pixel coords inside the chart wrapper
  containerSize,       // { w, h } — chart wrapper size for edge-clamp
  initialMinute,
  initialDrug,
  drugList,
  drugUnits,
  drugShortNames,
  clinicalDefaults,
  lastDoseByDrug,
  isClockMode,
  startTime,
  quickAddBolus,
  quickAddInfusion,
  // Phase 5-H-3 (B): edit mode props.
  editingEvent,        // null | event object — when provided the popover is in edit mode
  onUpdate,            // (oldId, newEventData) — called by Update button
  onDelete,            // (eventId) — called by Delete button
  t,
}) {
  const isEdit = !!editingEvent;
  const ref = useRef(null);

  const [drug, setDrug] = useState(initialDrug);
  const [type, setType] = useState('bolus');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [unit, setUnit] = useState(drugUnits[initialDrug]?.[0] || 'mcg/kg/hr');
  const [duration, setDuration] = useState(60);
  const [isInfinite, setIsInfinite] = useState(true);
  const [time, setTime] = useState(initialMinute);

  // Reset everything when the popover is re-opened. In edit mode pre-fill from the
  // editingEvent; in add mode pre-fill from lastDoseByDrug like before.
  useEffect(() => {
    if (!open) return;
    if (editingEvent) {
      const evDrug = editingEvent.drug || initialDrug;
      setDrug(evDrug);
      setType(editingEvent.type);
      setTime(editingEvent.time);
      if (editingEvent.type === 'bolus') {
        setAmount(String(editingEvent.amount ?? ''));
        // Keep infusion fields seeded from lastDose so the user can switch type without losing context
        const last = lastDoseByDrug?.[evDrug];
        setRate(last?.infusionRate != null ? String(last.infusionRate) : '');
        setUnit(last?.infusionUnit && drugUnits[evDrug]?.includes(last.infusionUnit)
          ? last.infusionUnit
          : (drugUnits[evDrug]?.[0] || 'mcg/kg/hr'));
        setDuration(last?.infusionDuration != null ? last.infusionDuration : 60);
        setIsInfinite(typeof last?.isInfinite === 'boolean' ? last.isInfinite : true);
      } else {
        setRate(String(editingEvent.originalRate ?? editingEvent.rate ?? ''));
        setUnit(editingEvent.originalUnit && drugUnits[evDrug]?.includes(editingEvent.originalUnit)
          ? editingEvent.originalUnit
          : (drugUnits[evDrug]?.[0] || 'mcg/kg/hr'));
        setDuration(editingEvent.duration ?? 60);
        setIsInfinite(!!editingEvent.isInfinite);
        const last = lastDoseByDrug?.[evDrug];
        setAmount(last?.bolusAmount != null ? String(last.bolusAmount) : '');
      }
      return;
    }
    // Add mode (default)
    setDrug(initialDrug);
    setType('bolus');
    setTime(initialMinute);
    const last = lastDoseByDrug?.[initialDrug];
    setAmount(last?.bolusAmount != null ? String(last.bolusAmount) : '');
    setRate(last?.infusionRate != null ? String(last.infusionRate) : '');
    setUnit(
      last?.infusionUnit && drugUnits[initialDrug]?.includes(last.infusionUnit)
        ? last.infusionUnit
        : (drugUnits[initialDrug]?.[0] || 'mcg/kg/hr')
    );
    setDuration(last?.infusionDuration != null ? last.infusionDuration : 60);
    setIsInfinite(typeof last?.isInfinite === 'boolean' ? last.isInfinite : true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDrug, initialMinute, editingEvent?.id]);

  // Drug switch within the popover — re-pull defaults for the new drug, keep the time.
  useEffect(() => {
    const last = lastDoseByDrug?.[drug];
    if (last?.bolusAmount != null) setAmount(String(last.bolusAmount));
    else setAmount('');
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

  // Outside click + Escape close.
  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const doseUnit = clinicalDefaults[drug]?.unit || 'mcg';
  const step = DRUG_DOSE_STEPS[drug] ?? 1;
  const valEntered = type === 'bolus'
    ? !!amount && parseFloat(amount) > 0
    : !!rate && parseFloat(rate) > 0;

  const stepAmount = (delta) => {
    const cur = parseFloat(amount) || 0;
    const next = Math.max(0, cur + delta);
    setAmount(String(roundStep(next, Math.abs(delta))));
  };

  const handleAdd = () => {
    if (!valEntered) return;
    if (type === 'bolus') {
      quickAddBolus(drug, parseFloat(amount), time);
    } else {
      quickAddInfusion(drug, parseFloat(rate), unit, time, parseFloat(duration), isInfinite);
    }
    onClose();
  };

  // Phase 5-H-3 (B): pass raw user inputs to App.jsx so handleEventUpdate can apply the
  // same standard-unit conversion path quickAddInfusion uses for new events.
  const handleUpdate = () => {
    if (!editingEvent || !valEntered) return;
    if (type === 'bolus') {
      onUpdate(editingEvent.id, { drug, type: 'bolus', time, amount: parseFloat(amount) });
    } else {
      onUpdate(editingEvent.id, {
        drug,
        type: 'infusion',
        time,
        rate: parseFloat(rate),
        unit,
        duration: parseFloat(duration),
        isInfinite,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editingEvent) return;
    onDelete(editingEvent.id);
    onClose();
  };

  // Edge clamp — keep the popover inside the chart wrapper. Width fixed at ~290px for w-72.
  const POPOVER_W = 290;
  const POPOVER_H = 240; // approximate, used for top-clamp only
  const wrapW = containerSize?.w || 1000;
  const wrapH = containerSize?.h || 400;
  const halfW = POPOVER_W / 2;
  // X clamp
  const minLeft = halfW + 6;
  const maxLeft = wrapW - halfW - 6;
  const clampedX = Math.max(minLeft, Math.min(position.x, maxLeft));
  // Y clamp — try above the click; if not enough room, drop below
  const placeAbove = position.y >= POPOVER_H + 12;
  const yTransform = placeAbove ? 'translate(-50%, -110%)' : 'translate(-50%, 12px)';
  const clampedY = Math.max(0, Math.min(position.y, wrapH));

  return (
    <div
      ref={ref}
      className="absolute z-50 glass shadow-xl border border-slate-300 dark:border-slate-600 rounded-lg p-3 w-72 select-none"
      style={{ left: clampedX, top: clampedY, transform: yTransform }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {isEdit && <Edit2 className="w-3 h-3 text-amber-600" />}
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {isClockMode
              ? `${minutesToTime(time, startTime)} (${time} min)`
              : `${time} min`}
          </span>
          {isEdit && (
            <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
              {t('editingEventLabel')}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drug chips */}
      <div className="flex flex-wrap gap-1 mb-2">
        {drugList.map((d) => {
          const isActive = d === drug;
          return (
            <button
              key={d}
              onClick={() => setDrug(d)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:bg-slate-700'
              }`}
            >
              {drugShortNames[d] || d}
            </button>
          );
        })}
      </div>

      {/* Type toggle */}
      <div className="flex bg-slate-100 dark:bg-slate-700 rounded p-0.5 mb-2 w-fit">
        <button
          onClick={() => setType('bolus')}
          className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 ${
            type === 'bolus' ? 'bg-purple-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:bg-slate-700'
          }`}
        >
          <Syringe className="w-3 h-3" />
          Bolus
        </button>
        <button
          onClick={() => setType('infusion')}
          className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 ${
            type === 'infusion' ? 'bg-orange-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:bg-slate-700'
          }`}
        >
          <Clock className="w-3 h-3" />
          Inf
        </button>
      </div>

      {/* Dose / Rate input */}
      {type === 'bolus' ? (
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => stepAmount(-step)}
            disabled={(parseFloat(amount) || 0) <= 0}
            className="w-7 h-8 flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-700 rounded disabled:bg-slate-100 dark:bg-slate-700 disabled:text-slate-400 dark:text-slate-500"
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
            onKeyDown={(e) => { if (e.key === 'Enter' && valEntered) handleAdd(); }}
            placeholder={t('dose')}
            className="w-20 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm font-bold text-center bg-purple-50 text-purple-900 focus:ring-2 focus:ring-purple-300 focus:outline-none"
          />
          <button
            onClick={() => stepAmount(step)}
            className="w-7 h-8 flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-700 rounded"
          >
            <Plus className="w-3 h-3" />
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 font-mono ml-0.5">{doseUnit}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-wrap mb-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valEntered) handleAdd(); }}
            placeholder={t('rate')}
            className="w-20 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm font-bold text-center bg-orange-50 text-orange-900 focus:ring-2 focus:ring-orange-300 focus:outline-none"
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
              className="w-16 border border-slate-300 dark:border-slate-600 rounded px-1 py-1.5 text-xs text-center"
            />
          )}
        </div>
      )}

      {/* Time fine-tune */}
      <div className="flex items-center gap-1 mb-2 text-xs">
        <button
          onClick={() => setTime(time - 5)}
          className="px-1.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-bold"
        >
          −5m
        </button>
        <button
          onClick={() => setTime(time - 1)}
          className="px-1.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-bold"
        >
          −1m
        </button>
        <input
          type="number"
          value={time}
          onChange={(e) => setTime(parseFloat(e.target.value) || 0)}
          className="w-16 border border-slate-300 dark:border-slate-600 rounded px-1 py-1 text-center font-mono"
        />
        <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">min</span>
        <button
          onClick={() => setTime(time + 1)}
          className="px-1.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-bold"
        >
          +1m
        </button>
        <button
          onClick={() => setTime(time + 5)}
          className="px-1.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-bold"
        >
          +5m
        </button>
      </div>

      {/* Action buttons — Add (default) or Update + Delete (edit mode) */}
      {isEdit ? (
        <div className="flex gap-1.5">
          <button
            onClick={handleUpdate}
            disabled={!valEntered}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded font-semibold text-sm disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            {t('update')}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded font-semibold text-sm flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('delete')}
          </button>
        </div>
      ) : (
        <button
          onClick={handleAdd}
          disabled={!valEntered}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded font-semibold text-sm disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      )}
    </div>
  );
}
