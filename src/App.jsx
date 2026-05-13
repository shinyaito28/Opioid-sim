
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea, Label } from 'recharts';
import { Syringe, Clock, Settings, User, Activity, Plus, Trash2, Save, X, Eye, EyeOff, ZoomIn, Baby, Edit2, AlertCircle, Wand2, Info, FileText, Layers, FolderOpen, Download, MousePointerClick, RotateCcw } from 'lucide-react';
import TopBar from './components/TopBar';
import QuickEntry from './components/QuickEntry';
import ChartEventPopover from './components/ChartEventPopover';
import TherapeuticReferenceModal from './components/TherapeuticReferenceModal';
import SummaryCard from './components/SummaryCard';
import ClinicalAlerts from './components/ClinicalAlerts';
import {
  THERAPEUTIC_RANGES,
  DRUG_UNITS,
  CLINICAL_DEFAULTS,
  AVAILABLE_MODELS,
  DRUG_SHORT_NAMES,
  DRUG_COLORS,
  DRUG_CLASS,
  DRUG_DISPLAY,
  DRUG_LIST,
  getDoseUnitForDrug,
  getPKParameters,
  convertToStandardUnit,
  convertFromStandardUnit,
} from './lib/drugs';
import { simulateConcentration, processEvents } from './lib/simulation';
import { computeBurdenAUC } from './lib/burden';
import { computeAlerts } from './lib/alerts';
import { useDarkMode } from './hooks/useDarkMode';


/**
 * ------------------------------------------------------------------
 * CONSTANTS & DATA
 * ------------------------------------------------------------------
 */

// Drug data, PK parameters, and unit-conversion helpers live in src/lib/drugs.js (imported above).
// THERAPEUTIC_RANGES, DRUG_UNITS, CLINICAL_DEFAULTS, AVAILABLE_MODELS, DRUG_SHORT_NAMES, DRUG_COLORS,
// getDoseUnitForDrug, getPKParameters, convertToStandardUnit, convertFromStandardUnit, calculateLBM
// are all imported, not defined here, so this file stays focused on UI state + handlers.

// Custom Recharts tooltip — keeps default Cp/Ce values, then lists any dosing events at/near the hover time.
// Multi-drug: each event is labelled with its own drug short name + per-drug unit (read from evt.drug).
const ChartTooltip = ({ active, payload, label, events, isClockMode, startTime, timeZeroMinute = 0 }) => {
  if (!active || !payload || payload.length === 0) return null;
  const time = Number(label);
  const relMin = time - timeZeroMinute;
  const headerLabel = isClockMode
    ? `${minutesToTime(time, startTime)} (${time} min)`
    : timeZeroMinute > 0
      ? `${relMin >= 0 ? '+' : ''}${relMin} min (T${time})`
      : `${time} min`;

  const nearbyEvents = events.filter((e) => {
    if (e.type === 'bolus') return Math.abs(e.time - time) <= 0.5;
    if (e.type === 'infusion') {
      const endTime = e.isInfinite ? Infinity : e.time + e.duration;
      return time >= e.time - 0.5 && time <= endTime + 0.5;
    }
    return false;
  });

  return (
    <div className="bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 dark:border-slate-600 rounded-lg shadow p-2 text-xs min-w-[140px]">
      <div className="font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-200 mb-1">{headerLabel}</div>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex justify-between gap-3" style={{ color: entry.color }}>
          <span>{entry.name}</span>
          <span className="font-mono font-bold">{entry.value?.toFixed?.(2) ?? entry.value}</span>
        </div>
      ))}
      {nearbyEvents.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700 dark:border-slate-600 space-y-0.5">
          {nearbyEvents.map((e) => {
            const evtDrug = e.drug || 'Fentanyl';
            const evtShort = DRUG_SHORT_NAMES[evtDrug] || evtDrug;
            const evtUnit = getDoseUnitForDrug(evtDrug);
            const evtTimeLabel = isClockMode ? minutesToTime(e.time, startTime) : `${e.time}min`;
            if (e.type === 'bolus') {
              return (
                <div key={e.id} className="text-[10px] text-purple-700">
                  <span className="font-bold">▼</span> {evtShort} {e.amount}{evtUnit} @{evtTimeLabel}
                </div>
              );
            }
            const rateText = e.originalRate && e.originalUnit
              ? `${e.originalRate} ${e.originalUnit}`
              : `${e.rate}/hr`;
            const durLabel = e.isInfinite ? '∞' : `${e.duration}min`;
            return (
              <div key={e.id} className="text-[10px] text-orange-700">
                <span className="font-bold">▶</span> {evtShort} {rateText} ({durLabel})
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * ------------------------------------------------------------------
 * HELPER: GROWTH ESTIMATION
 * ------------------------------------------------------------------
 */
const estimateGrowth = (age, gender) => {
  if (age < 0) return { height: 50, weight: 3 };
  if (age === 0) return { height: 60, weight: 6 };
  if (age <= 12) {
    const h = 75 + (age - 1) * 6.8;
    const w = 9 + (age - 1) * 3.0;
    return { height: Math.round(h), weight: Math.round(w) };
  }
  if (age <= 18) {
    if (gender === 'male') {
      const h = 150 + (age - 12) * 3.5;
      const w = 40 + (age - 12) * 4.2;
      return { height: Math.min(Math.round(h), 171), weight: Math.min(Math.round(w), 65) };
    } else {
      const h = 150 + (age - 12) * 1.5;
      const w = 40 + (age - 12) * 2.0;
      return { height: Math.min(Math.round(h), 158), weight: Math.min(Math.round(w), 53) };
    }
  }
  if (gender === 'male') return { height: 171, weight: 68 };
  return { height: 158, weight: 53 };
};

/**
 * ------------------------------------------------------------------
 * PHARMACOKINETIC MODELS & MATH ENGINE
 * ------------------------------------------------------------------
 */


const timeToMinutes = (timeStr, startStr) => {
  if (!timeStr || !startStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const [sh, sm] = startStr.split(':').map(Number);
  return (h * 60 + m) - (sh * 60 + sm);
};

const minutesToTime = (minutes, startStr) => {
  if (!startStr) return "00:00";
  const [sh, sm] = startStr.split(':').map(Number);
  const totalMin = sh * 60 + sm + minutes;
  let h = Math.floor(totalMin / 60) % 24;
  if (h < 0) h += 24;
  let m = Math.floor(totalMin % 60);
  if (m < 0) m += 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const getModelRequirements = (drug, model) => {
  if (drug === 'Remifentanil' && model.includes('Minto')) return ['age', 'weight', 'height', 'gender'];
  if (drug === 'Hydromorphone' && model.includes('Jeleazcov')) return ['age', 'weight'];
  if (drug === 'Fentanyl' && model.includes('Shafer')) return [];
  if (drug === 'Methadone') return ['weight'];
  if (drug === 'Sufentanil') return ['weight'];
  if (drug === 'Propofol') return ['age', 'weight', 'height', 'gender']; // Eleveld uses all four covariates
  if (drug === 'Remimazolam') return ['weight']; // Eleveld 2025 simplified to weight-only here
  if (drug === 'Ketamine') return ['weight']; // Noppers 2011 allometric W/70
  if (drug === 'Dexmedetomidine') return ['weight']; // Hannivoort 2015 — weight is the only covariate
  return ['weight'];
};

// --- BEST MODEL SELECTOR HELPER ---
const getBestModel = (drug, age) => {
  const isPeds = age < 12;
  if (drug === 'Fentanyl') return isPeds ? 'Ginsberg (Pediatric)' : 'Bae (2020) Adult';
  if (drug === 'Remifentanil') return isPeds ? 'Rigby-Jones (Pediatric)' : 'Minto (Adult)';
  if (drug === 'Morphine') {
    if (age < 1) return 'Anand (2008) Neonate'; // Under 1 year used as proxy for neonate/infant focus
    if (isPeds) return 'Bouwmeester (2004) Pediatric';
    return 'Mazoit (2007) Adult';
  }
  if (drug === 'Hydromorphone') return isPeds ? 'Balyan (2020) Pediatric' : 'Jeleazcov (2014) Adult';
  if (drug === 'Methadone') return 'Standard (Adult)';
  if (drug === 'Sufentanil') return isPeds ? 'Bartkowska-Sniatkowska (2016) PICU' : 'Gepts (1995) Adult';
  if (drug === 'Propofol') return 'Eleveld (2018) General-purpose'; // Eleveld covers all ages
  if (drug === 'Remimazolam') return 'Eleveld (2025) Adult';
  if (drug === 'Ketamine') return 'Noppers (2011) S-ketamine';
  if (drug === 'Dexmedetomidine') return 'Hannivoort (2015) Adult';
  return 'Bae (2020) Adult';
};

const estimateBolus = (drug, weight) => {
  let dose = 0;
  // Clinical Defaults (per kg)
  // Rounded for simplicity (1 sig digit approx)
  if (drug === 'Fentanyl') dose = weight * 2.0;       // 2 mcg/kg
  else if (drug === 'Remifentanil') dose = weight * 1.0; // 1 mcg/kg (Intubation/Induction) - cleaner than 0.5
  else if (drug === 'Morphine') dose = weight * 0.1;     // 0.1 mg/kg
  else if (drug === 'Hydromorphone') dose = weight * 0.02; // 0.02 mg/kg (approx 1.5mg/70kg) - cleaner than 0.015
  else if (drug === 'Methadone') dose = weight * 0.1;    // 0.1 mg/kg
  else if (drug === 'Sufentanil') dose = weight * 0.1;   // 0.1 mcg/kg (cleaner than 0.15)
  else if (drug === 'Propofol') dose = weight * 1.5;     // 1.5 mg/kg (induction)
  else if (drug === 'Remimazolam') dose = weight * 0.1;  // 0.1 mg/kg (induction-like; clinical induction is typically a 1-min infusion of 6-12 mg)
  else if (drug === 'Ketamine') dose = weight * 0.5;     // 0.5 mg/kg sub-anesthetic (analgesic / induction adjunct)
  else if (drug === 'Dexmedetomidine') dose = weight * 1.0; // 1 mcg/kg loading bolus (over 10 min clinically)

  if (dose === 0) return 0;

  // Strict 1 Significant Digit Rounding
  // Examples: 0.15 -> 0.2,  1.2 -> 1,  15 -> 20, 120 -> 100
  // User requested "effective number 1 digit" and "realistic".
  // For clinical safety, we should be careful about rounding UP too much, 
  // but for "simulator defaults" simplicity is key.

  return parseFloat(dose.toPrecision(1));
};


/**
 * ------------------------------------------------------------------
 * UI COMPONENTS
 * ------------------------------------------------------------------
 */

const App = () => {
  const { t, i18n } = useTranslation();
  const [patient, setPatient] = useState({
    age: 10, weight: 30, height: 138, gender: 'male'
  });
  const [autoFillStats, setAutoFillStats] = useState(true);

  // Phase 5-C: drug is now the *editor* drug (QuickEntry's selected drug); events can mix drugs.
  const [drug, setDrug] = useState('Fentanyl');
  // Per-drug PK model selection — replaces the old single `model`. UI reads modelByDrug[drug].
  const [modelByDrug, setModelByDrug] = useState({});

  const [bolusAmount, setBolusAmount] = useState(CLINICAL_DEFAULTS['Fentanyl'].bolus);
  const [bolusTime, setBolusTime] = useState(0);
  const [infusionRate, setInfusionRate] = useState(CLINICAL_DEFAULTS['Fentanyl'].rate);
  const [infusionStartTime, setInfusionStartTime] = useState(0);
  const [infusionDuration, setInfusionDuration] = useState(60);
  const [isInfiniteDuration, setIsInfiniteDuration] = useState(true);
  const [infusionUnit, setInfusionUnit] = useState(DRUG_UNITS['Fentanyl'][0]);

  const [events, setEvents] = useState([]);

  // Phase 5-H-1: chart-click popover state. Opens at the clicked location and lets the user
  // pick drug / type / dose / time without leaving the chart, then calls quickAddBolus or
  // quickAddInfusion. {open=false} keeps the popover hidden.
  // Phase 5-H-3 added editingEventId — when set to an event id, the popover opens in edit
  // mode (Update / Delete buttons) instead of the default Add mode.
  const [chartPopover, setChartPopover] = useState({ open: false, x: 0, y: 0, minute: 0, editingEventId: null });
  const chartWrapperRef = useRef(null);
  // Phase 5-H-4: drag-to-reschedule. dragStateRef carries drag-in-progress info between
  // pointer events without triggering re-renders; dragEndTimeRef is a timestamp the
  // existing onClick / onTouchEnd handlers consult to suppress a popover that would
  // otherwise open on the click that follows a drag release.
  const dragStateRef = useRef(null);
  const dragEndTimeRef = useRef(0);

  // Phase 5-I-1: theme. Hook owns the html.dark class + localStorage + meta theme-color.
  // The chart Recharts components are not styled by Tailwind so we derive a small
  // chartColors object that switches axis / grid / tooltip colours per theme.
  const [isDark, setIsDark] = useDarkMode();
  const chartColors = isDark
    ? { axisStroke: '#94a3b8', gridStroke: '#334155', tooltipBg: '#1e293b', tooltipText: '#f1f5f9', tooltipBorder: '#475569' }
    : { axisStroke: '#475569', gridStroke: '#f1f5f9', tooltipBg: '#ffffff', tooltipText: '#0f172a', tooltipBorder: '#cbd5e1' };

  const [simDuration, setSimDuration] = useState(120);
  const [maxTimeScale, setMaxTimeScale] = useState(720);

  const [savedTraces, setSavedTraces] = useState([]);
  const [savedScenarios, setSavedScenarios] = useState([]); // SAVE/RESTORE FEATURE
  // Phase 5-L-1: track the currently-loaded named scenario so the user can overwrite-
  // save instead of always creating a new entry. null = no named scenario loaded
  // (the localStorage auto-save still preserves working state across refreshes).
  const [currentScenarioId, setCurrentScenarioId] = useState(null);
  // Phase 5-L-1: dirty-flag relative to the loaded scenario. localStorage useEffect
  // sets lastSavedAt on every persisted change; isModified flips to true on any
  // patient/drug/event mutation while a named scenario is loaded.
  const [isModified, setIsModified] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  // Per-drug last-used amounts/rates so the QuickEntry form pre-fills sensibly when a drug is reselected.
  const [lastDoseByDrug, setLastDoseByDrug] = useState({});
  const [showRanges, setShowRanges] = useState(true);
  const [yAxisMax, setYAxisMax] = useState(6);
  // Phase 5-J-1: Y-axis display mode. 'therapeutic' is the new default — keeps the
  // analgesic band and respiratory-risk threshold visible regardless of PK peak. 'full'
  // is the previous data-peak auto-fit; 'custom' uses the yAxisMax slider/input.
  const [yAxisMode, setYAxisMode] = useState('therapeutic'); // 'full' | 'therapeutic' | 'custom'
  const [isClockMode, setIsClockMode] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  // Phase 5-J-2: display-only X-axis origin offset. event.time is unchanged; only
  // tick labels and the tooltip header subtract this. 0 = sim-start origin (default).
  // Mutually exclusive with isClockMode (clock-mode owns absolute time semantics).
  const [timeZeroMinute, setTimeZeroMinute] = useState(0);
  // Phase 5-J-3: burden-curve visibility (right-axis instantaneous risk indicator)
  // and burden-info expander (definition explainer). Curve defaults visible.
  const [showBurdenCurve, setShowBurdenCurve] = useState(true);
  const [showBurdenInfo, setShowBurdenInfo] = useState(false);
  // Phase 5-L-2: which summary card has its help popover open. null = none.
  // Single-selection so opening one closes the others.
  const [summaryHelpOpen, setSummaryHelpOpen] = useState(null); // 'peak' | 'onset' | 'resp' | 'recovery' | null

  // Phase 5-M: chart class — which drug family the main chart is rendering. Auto-
  // estimated from activeOpioids/activeSedatives unless the user has manually
  // toggled, in which case the override sticks until they manually toggle back.
  // 'opioid' (default) | 'sedative'.
  const [chartClass, setChartClass] = useState('opioid');
  const chartClassManualRef = useRef(false);
  // Phase 5-J-4: X-axis lower bound (display only; data isn't trimmed). Default 0.
  // Combined with simDuration this gives the full chart-window. Negative values are
  // sometimes useful with timeZeroMinute for showing pre-event minutes.
  const [xAxisMin, setXAxisMin] = useState(0);
  // Phase 5-J-4: per-drug therapeutic-range overrides. Empty object = use literature
  // defaults from THERAPEUTIC_RANGES. Override only the analgesia band (analgesiaMin,
  // analgesiaMax); respiratoryRisk stays literature-based since it is a safety value.
  const [therapeuticOverrides, setTherapeuticOverrides] = useState({});
  // Phase 5-K-2: therapeutic-reference modal toggle. Triggered by ⓘ button next to drug select.
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // --- PERSISTENCE: LOAD ---
  useEffect(() => {
    const savedData = localStorage.getItem('opioid_sim_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.patient) setPatient(parsed.patient);
        if (parsed.drug) setDrug(parsed.drug);

        // Phase 5-C migration: pre-v2 saves had a single `model` string and untagged events.
        // Convert to per-drug map and stamp every legacy event with the saved drug.
        if (parsed.modelByDrug) {
          setModelByDrug(parsed.modelByDrug);
        } else if (parsed.model && parsed.drug) {
          setModelByDrug({ [parsed.drug]: parsed.model });
        }

        if (parsed.events) {
          const legacyDrug = parsed.drug || 'Fentanyl';
          const migrated = parsed.schemaVersion >= 2
            ? parsed.events
            : parsed.events.map((e) => ({ ...e, drug: e.drug || legacyDrug }));
          setEvents(migrated);
        }

        if (parsed.simDuration) setSimDuration(parsed.simDuration);
        if (parsed.savedTraces) setSavedTraces(parsed.savedTraces);
        if (parsed.savedScenarios) setSavedScenarios(parsed.savedScenarios);
        if (parsed.lastDoseByDrug) setLastDoseByDrug(parsed.lastDoseByDrug);
        if (parsed.isClockMode !== undefined) setIsClockMode(parsed.isClockMode);
        if (parsed.simSettings?.startTime) setStartTime(parsed.simSettings.startTime);
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    }
  }, []);

  // --- PERSISTENCE: SAVE ---
  // Phase 5-L-1: also record lastSavedAt so the TopBar auto-save indicator can show
  // the user that their working state is persisted (it always was — Phase 1 — but
  // there was no UI signal of that fact).
  useEffect(() => {
    const dataToSave = {
      schemaVersion: 2,
      patient,
      drug,
      modelByDrug,
      events,
      simDuration,
      savedTraces,
      savedScenarios,
      lastDoseByDrug,
      isClockMode,
      simSettings: { startTime }
    };
    localStorage.setItem('opioid_sim_data', JSON.stringify(dataToSave));
    setLastSavedAt(Date.now());
  }, [patient, drug, modelByDrug, events, simDuration, savedTraces, savedScenarios, lastDoseByDrug, isClockMode, startTime]);

  // Phase 5-L-1: dirty-flag tracking against the currently-loaded named scenario.
  // Any patient/drug/event/model/duration change after a load marks the scenario as
  // modified; saveScenario(currentScenarioId) and loadScenario both clear the flag.
  useEffect(() => {
    if (currentScenarioId != null) {
      setIsModified(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient, drug, modelByDrug, events, simDuration]);

  const [editingId, setEditingId] = useState(null);

  // Phase 5-C derived state — multi-drug simulation hub.
  // activeDrugs: union of every drug currently represented by an event. Drives chart line iteration.
  const activeDrugs = useMemo(
    () => new Set(events.map((e) => e.drug || drug)),
    [events, drug]
  );

  // Phase 5-G-2-a: split activeDrugs by class.
  // Phase 5-M: both classes now render on the same main chart, controlled by
  // chartClass below. SedationChart mini-charts removed.
  const activeOpioids = useMemo(
    () => [...activeDrugs].filter((d) => DRUG_CLASS[d] !== 'sedative'),
    [activeDrugs]
  );
  const activeSedatives = useMemo(
    () => [...activeDrugs].filter((d) => DRUG_CLASS[d] === 'sedative'),
    [activeDrugs]
  );

  // Phase 5-M: auto-estimate chartClass from active drug classes. Rules:
  //   only opioids  active  → chartClass = 'opioid'
  //   only sedatives active → chartClass = 'sedative'
  //   both active           → keep current chartClass (don't yank the view)
  //   no drugs active       → keep current (no need to switch on empty state)
  // The manualRef gate prevents auto-estimate from clobbering a deliberate
  // user toggle in the mixed-drug case.
  useEffect(() => {
    if (chartClassManualRef.current) return;
    if (activeOpioids.length > 0 && activeSedatives.length === 0) {
      setChartClass('opioid');
    } else if (activeSedatives.length > 0 && activeOpioids.length === 0) {
      setChartClass('sedative');
    }
  }, [activeOpioids.length, activeSedatives.length]);

  // Toggle handler that records manual intent so subsequent auto-estimates
  // don't overwrite the user's choice.
  const handleChartClassToggle = (newClass) => {
    chartClassManualRef.current = true;
    setChartClass(newClass);
  };

  // Phase 5-M: which drugs to actually plot — depends on chartClass.
  const plotDrugs = chartClass === 'sedative' ? activeSedatives : activeOpioids;

  // Phase 5-M: single "primary drug" that drives axes, reference areas, summary
  // ranges. Prefer the user's current drug select if it belongs to the active
  // chartClass; otherwise fall back to the first active drug of that class.
  const primaryDrugForChart = useMemo(() => {
    if (chartClass === 'sedative') {
      if (DRUG_CLASS[drug] === 'sedative') return drug;
      return activeSedatives[0] ?? drug;
    }
    if (DRUG_CLASS[drug] !== 'sedative') return drug;
    return activeOpioids[0] ?? drug;
  }, [chartClass, drug, activeOpioids, activeSedatives]);

  // model & setModel are derived shims so existing detail-form code (which mutates a single
  // string) continues to operate on modelByDrug[drug] under the hood.
  const model = modelByDrug[drug] || getBestModel(drug, patient.age);
  const setModel = (next) => setModelByDrug((prev) => ({ ...prev, [drug]: next }));

  // Per-drug 3-comp + Ce simulation. Includes the editor drug so the model-params display + summary
  // metrics work even before any event is added.
  const simByDrug = useMemo(() => {
    const result = new Map();
    const drugsToSim = new Set(activeDrugs);
    drugsToSim.add(drug);
    for (const d of drugsToSim) {
      const drugEvents = events.filter((e) => (e.drug || drug) === d);
      const drugModel = modelByDrug[d] || getBestModel(d, patient.age);
      const params = getPKParameters(d, drugModel, patient);
      const proc = processEvents(drugEvents, simDuration);
      const sim = simulateConcentration(proc, params, simDuration, d);
      result.set(d, sim);
    }
    return result;
  }, [events, modelByDrug, patient, simDuration, drug, activeDrugs]);

  // Backwards-compat aliases — many existing useMemos / chart props read these names.
  const parameters = useMemo(
    () => getPKParameters(drug, model, patient),
    [drug, model, patient]
  );
  const simData = simByDrug.get(drug) || [];

  // Phase 5-J-3.1: depression fraction via Hill γ=1 (competitive μ-opioid model).
  // Previously: burden(t) = Σ Ce_d/RespC50_d — linear sum, no upper bound, hard
  // to read clinically once it exceeds 1. New form folds the same normalized-Ce
  // sum R through the Hill function R/(1+R), giving a 0-1 fractional respiratory
  // depression that is directly interpretable:
  //   single drug at Ce = RespC50 → depression = 0.5 (= 50%, by C50 definition)
  //   single drug at Ce = 2·RespC50 → depression ≈ 0.67
  //   multiple opioids → independent additive normalized-Ce in same Hill function
  // Evidence base: Dahan 2004 (PMID:15505457) used γ ≈ 1 for hypercapnic/hypoxic
  // respiration; the additive-R form is standard μ-opioid competitive binding.
  const burdenSeries = useMemo(() => {
    if (activeDrugs.size === 0) return [];
    const len = simDuration + 1;
    const result = [];
    for (let t = 0; t < len; t++) {
      let R = 0;
      for (const d of activeDrugs) {
        const sim = simByDrug.get(d);
        const point = sim?.[t];
        if (!point) continue;
        const respRisk = THERAPEUTIC_RANGES[d]?.respiratoryRisk;
        if (!respRisk) continue;
        R += (point.ce || 0) / respRisk;
      }
      const depression = R / (1 + R);
      result.push({ time: t, burden: parseFloat(depression.toFixed(3)) });
    }
    return result;
  }, [simByDrug, activeDrugs, simDuration]);

  // Phase 5-J-3: cumulative AUC-based burden, drug-summed across active opioids.
  // Complements burdenSeries (instantaneous risk) — see src/lib/burden.js for the
  // exact integral definitions.
  const burdenAUC = useMemo(() => {
    let total = 0;
    let therapeutic = 0;
    let supra = 0;
    for (const d of activeOpioids) {
      const sim = simByDrug.get(d);
      if (!sim?.length) continue;
      // Phase 5-J-4: honour per-drug therapeutic overrides for the AUC band-clipping.
      const range = { ...THERAPEUTIC_RANGES[d], ...(therapeuticOverrides[d] || {}) };
      const auc = computeBurdenAUC(sim, range);
      total += auc.total;
      therapeutic += auc.therapeutic;
      supra += auc.supra;
    }
    return { total, therapeutic, supra };
  }, [simByDrug, activeOpioids, therapeuticOverrides]);

  // Phase 5-L-4: rule-based clinical alerts. Returns structured records that the
  // ClinicalAlerts component renders as colour-coded cards under the summary.
  const clinicalAlerts = useMemo(() => {
    // Per-drug effective ranges = literature defaults + user overrides.
    const ranges = {};
    for (const d of activeOpioids) {
      ranges[d] = { ...THERAPEUTIC_RANGES[d], ...(therapeuticOverrides[d] || {}) };
    }
    return computeAlerts({
      simByDrug,
      ranges,
      events,
      activeOpioids: [...activeOpioids],
      simDuration,
    });
  }, [simByDrug, activeOpioids, therapeuticOverrides, events, simDuration]);

  const activeParams = useMemo(() => getModelRequirements(drug, model), [drug, model]);

  const getFieldStyle = (paramName) => {
    if (activeParams.includes(paramName)) {
      return "bg-white dark:bg-slate-800 border-blue-300 dark:border-blue-700 ring-1 ring-blue-100 dark:ring-blue-900/40 text-slate-800 dark:text-slate-100 font-medium";
    }
    return "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-80";
  };

  const getLabelStyle = (paramName) => {
    if (activeParams.includes(paramName)) {
      return "text-blue-600 font-bold";
    }
    return "text-slate-400 dark:text-slate-500";
  };

  // --- REAL-TIME CALCULATION ---
  const currentSimMinutes = useMemo(() => {
    if (!isClockMode) return null;
    const now = currentTime;
    const [startH, startM] = startTime.split(':').map(Number);
    const start = new Date(now);
    start.setHours(startH, startM, 0, 0);

    // If start time is in future relative to now (e.g. set 09:00 when it's 08:00), 
    // usually implies previous day, but for sim simplicity we just take diff.
    // If diff is negative, it means we are before start time.
    const diffMs = now - start;
    return Math.floor(diffMs / 60000);
  }, [currentTime, startTime, isClockMode]);

  const currentValues = useMemo(() => {
    if (currentSimMinutes === null || simData.length === 0) return null;
    // Find closest data point
    const point = simData.find(d => d.time >= currentSimMinutes);
    return point || null;
  }, [currentSimMinutes, simData]);

  // --- SUMMARY METRICS ---
  // For opioids: onset = time to Ce ≥ analgesiaMin; respRisk = minutes Ce ≥ respiratoryRisk.
  // For sedatives (Propofol): onset = time to Ce ≥ bisTarget.min; deepCount = minutes Ce ≥ bisTarget.max.
  // Cp/Ce values are in internal ng/mL — chart UI applies DRUG_DISPLAY[drug].divisor at render time.
  const summaryMetrics = useMemo(() => {
    if (!simData || simData.length === 0) return null;
    const range = THERAPEUTIC_RANGES[drug];
    if (!range) return null;

    // Resolve which thresholds apply for the current drug.
    const onsetThreshold = range.analgesiaMin ?? range.bisTarget?.min;
    const respRiskThreshold = range.respiratoryRisk ?? range.bisTarget?.max;
    const recoveryThreshold = range.analgesiaMin ?? range.bisTarget?.min;

    // Internal Ce/Cp are in ng/mL; sedatives need to be displayed in mcg/mL.
    // Multiply the threshold values by the inverse of the divisor to compare in same units.
    // bisTarget for Propofol is given in mcg/mL → multiply by 1000 to compare with ng/mL ce values.
    const isSedative = !!range.bisTarget;
    const thresholdScale = isSedative ? (DRUG_DISPLAY[drug]?.divisor || 1) : 1;
    const onsetThresholdInternal = onsetThreshold != null ? onsetThreshold * thresholdScale : null;
    const respRiskThresholdInternal = respRiskThreshold != null ? respRiskThreshold * thresholdScale : null;
    const recoveryThresholdInternal = recoveryThreshold != null ? recoveryThreshold * thresholdScale : null;

    let peakCe = { value: 0, time: 0 };
    let peakCp = { value: 0, time: 0 };
    let onsetTime = null;
    let respRiskCount = 0;

    simData.forEach(d => {
      if (d.ce > peakCe.value) peakCe = { value: d.ce, time: d.time };
      if (d.cp > peakCp.value) peakCp = { value: d.cp, time: d.time };
      if (onsetTime === null && onsetThresholdInternal != null && d.ce >= onsetThresholdInternal) onsetTime = d.time;
      if (respRiskThresholdInternal != null && d.ce >= respRiskThresholdInternal) respRiskCount++;
    });

    // Total dose: sum bolus + integrate infusion
    let totalDose = 0;
    events.forEach(evt => {
      if ((evt.drug || drug) !== drug) return; // only count current-drug events
      if (evt.type === 'bolus') {
        totalDose += evt.amount;
      } else if (evt.type === 'infusion') {
        let effDuration = evt.duration;
        if (evt.isInfinite) effDuration = Math.max(0, simDuration - evt.time);
        totalDose += evt.rate * (effDuration / 60);
      }
    });

    // Recovery: after the last terminating infusion stops, when ce drops below threshold
    let recoveryTime = null;
    const finiteInfusions = events.filter(e => (e.drug || drug) === drug && e.type === 'infusion' && !e.isInfinite);
    if (finiteInfusions.length > 0 && recoveryThresholdInternal != null) {
      const lastStop = Math.max(...finiteInfusions.map(e => e.time + e.duration));
      const recPoint = simData.find(d => d.time >= lastStop && d.ce < recoveryThresholdInternal);
      if (recPoint) recoveryTime = recPoint.time - lastStop;
    }

    return {
      peakCe,
      peakCp,
      onsetTime,
      respRiskMin: respRiskCount,
      totalDose,
      recoveryTime,
      drugUnit: CLINICAL_DEFAULTS[drug]?.unit || 'mcg',
      isSedative,
      onsetThreshold,        // in display units (ng/mL or mcg/mL)
      respRiskThreshold,     // in display units
      displayUnit: DRUG_DISPLAY[drug]?.unit || 'ng/mL',
      displayDivisor: DRUG_DISPLAY[drug]?.divisor || 1,
    };
  }, [simData, events, drug, simDuration]);

  // --- EFFECT: Sync Dose Time with Real Time in Clock Mode ---
  useEffect(() => {
    if (isClockMode && currentSimMinutes !== null) {
      // NOTE: User requested "One tap" setting, so auto-sync might be annoying if they want to enter past data.
      // But the original code was auto-syncing. I will keep it BUT only if editing NEW event?
      // Actually, let's keep the hook but rely on the new "NOW" button for manual control which is more explicit.
      // The original hook below updates bolusTime automatically.
      // If I keep this, the "Now" button is redundant for the initial moment, but useful if they changed it and want to go back.
      // However, typical behavior is: set time -> it stays. 
      // This hook makes it "follow" the clock. 
      // I'll leave it as is to avoid regression, but the "Now" button is helpful for manual override or reset.
      const shouldUpdate = (prev) => {
        if (prev === 0) return true;
        const diff = Math.abs(prev - currentSimMinutes);
        return diff <= 1 || Math.abs(prev - (currentSimMinutes - 1)) <= 1;
      };

      setBolusTime(prev => shouldUpdate(prev) ? currentSimMinutes : prev);
      setInfusionStartTime(prev => shouldUpdate(prev) ? currentSimMinutes : prev);
    }
  }, [currentSimMinutes, isClockMode]);

  // --- EFFECT: Auto-Fill Stats on Age Change ---
  useEffect(() => {
    if (autoFillStats) {
      const { height, weight } = estimateGrowth(patient.age, patient.gender);
      setPatient(prev => ({ ...prev, height, weight }));
    }
  }, [patient.age, patient.gender, autoFillStats]);

  // --- EFFECT: Handle Drug/Age Change & Auto-Select Best Model ---
  useEffect(() => {
    const bestModel = getBestModel(drug, patient.age);
    const currentModelIsForCurrentDrug = AVAILABLE_MODELS[drug].includes(model);

    const isPeds = patient.age < 12;
    const currentModelIsPeds = model.includes('Pediatric');
    const currentModelIsAdult = model.includes('Adult');

    if (!currentModelIsForCurrentDrug || (isPeds && currentModelIsAdult) || (!isPeds && currentModelIsPeds)) {
      setModel(bestModel);
    }

  }, [drug, patient.age]);

  // --- EFFECT: Auto-Fill Bolus on Weight/Drug Change ---
  useEffect(() => {
    if (autoFillStats) {
      const newBolus = estimateBolus(drug, patient.weight);
      setBolusAmount(newBolus);
    }
  }, [drug, patient.weight, autoFillStats]);

  // MOVED DRUG DEFAULT LOGIC TO handleDrugChange TO ENABLE PERSISTENCE


  // Phase 5-J-1: Y-axis domain computation across 3 modes. Also exposes the data peak
  // (and the time it occurred) so the chart can render an "exceeds visible range"
  // indicator when therapeutic / custom modes clip the peak from view.
  // - 'full'        → previous behaviour (peak * 1.2, with 5 ng/mL floor)
  // - 'therapeutic' → keep analgesia band + respiratory-risk line visible regardless
  //                   of PK peak. Drug-class aware (opioids / bisTarget / sedationBands).
  // - 'custom'      → user-set yAxisMax slider value
  const yAxisInfo = useMemo(() => {
    let dataPeak = 0;
    let peakTime = 0;
    for (const sim of simByDrug.values()) {
      if (sim.length === 0) continue;
      for (const point of sim) {
        if ((point.ce ?? 0) > dataPeak) {
          dataPeak = point.ce;
          peakTime = point.time;
        }
      }
    }
    savedTraces.forEach((trace) => {
      if (!trace.data?.length) return;
      for (const point of trace.data) {
        if ((point.ce ?? 0) > dataPeak) {
          dataPeak = point.ce;
          peakTime = point.time;
        }
      }
    });

    // Phase 5-M: range now follows the chartClass's primary drug so that switching
    // mode flips the therapeutic anchor (analgesiaMin/Max ↔ bisTarget/sedationBands)
    // without the user touching the drug select.
    const range = THERAPEUTIC_RANGES[primaryDrugForChart];
    let calculatedYMaxLocal;
    if (yAxisMode === 'custom') {
      calculatedYMaxLocal = yAxisMax;
    } else if (yAxisMode === 'full') {
      calculatedYMaxLocal = dataPeak <= 0 ? 5 : Math.ceil(dataPeak * 1.2);
    } else if (range?.respiratoryRisk) {
      calculatedYMaxLocal = Math.max(range.respiratoryRisk * 1.3, 5);
    } else if (range?.bisTarget?.max) {
      calculatedYMaxLocal = Math.max(range.bisTarget.max * 1.5, 5);
    } else if (range?.sedationBands?.length) {
      const upper = Math.max(...range.sedationBands.map((b) => b.max));
      calculatedYMaxLocal = Math.max(upper * 1.2, 1);
    } else {
      calculatedYMaxLocal = dataPeak <= 0 ? 5 : Math.ceil(dataPeak * 1.2);
    }
    return { calculatedYMax: calculatedYMaxLocal, dataPeak, peakTime };
  }, [yAxisMode, yAxisMax, primaryDrugForChart, simByDrug, savedTraces]);

  const calculatedYMax = yAxisInfo.calculatedYMax;


  // --- HANDLERS ---
  const addBolus = () => {
    let newTime = parseFloat(bolusTime);
    let currentEvents = [...events];

    if (isClockMode && newTime < 0) {
      const offset = -newTime;
      // Shift start time back
      const [sh, sm] = startTime.split(':').map(Number);
      let totalStartMin = sh * 60 + sm - offset;
      if (totalStartMin < 0) totalStartMin += 24 * 60;

      const newH = Math.floor(totalStartMin / 60);
      const newM = totalStartMin % 60;
      setStartTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);

      // Shift existing events forward
      currentEvents = currentEvents.map(e => ({
        ...e,
        time: e.time + offset
      }));

      newTime = 0; // The new event is now at 0
    }

    setEvents([...currentEvents, { id: Date.now(), drug, type: 'bolus', time: newTime, amount: parseFloat(bolusAmount) }]);
    setEditingId(null);
  };

  // Phase 5-M-2: when a new infusion of the same drug is scheduled, the clinical
  // mental model is "I'm changing the rate", not "I'm running two parallel
  // infusions". So any same-drug infusion that's still active at the new start
  // time is truncated to end exactly at the new event's start.
  //
  // This only touches same-drug overlap. Concurrent infusions of *different*
  // drugs remain independently summed by the simulation engine (Phase 5-C
  // bugfix is preserved).
  const truncateOverlappingInfusions = (eventsList, drugArg, newStartTime) => {
    return eventsList
      .map((e) => {
        if (e.drug !== drugArg || e.type !== 'infusion') return e;
        if (e.time >= newStartTime) return e; // future / same-time entries left to the caller
        const oldEnd = e.isInfinite ? Infinity : e.time + e.duration;
        if (oldEnd <= newStartTime) return e; // already finished naturally
        return {
          ...e,
          duration: newStartTime - e.time,
          isInfinite: false,
        };
      })
      // Drop zero/negative-duration leftovers defensively (shouldn't happen,
      // but a malformed override is better deleted than rendered).
      .filter((e) => !(e.drug === drugArg && e.type === 'infusion' && e.duration <= 0));
  };

  const addInfusion = () => {
    let newStartTime = parseFloat(infusionStartTime);
    let currentEvents = [...events];

    if (isClockMode && newStartTime < 0) {
      const offset = -newStartTime;
      // Shift start time back
      const [sh, sm] = startTime.split(':').map(Number);
      let totalStartMin = sh * 60 + sm - offset;
      if (totalStartMin < 0) totalStartMin += 24 * 60;

      const newH = Math.floor(totalStartMin / 60);
      const newM = totalStartMin % 60;
      setStartTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);

      // Shift existing events forward
      currentEvents = currentEvents.map(e => ({
        ...e,
        time: e.time + offset
      }));

      newStartTime = 0; // The new event starts at 0
    }

    const standardRate = convertToStandardUnit(parseFloat(infusionRate), infusionUnit, patient.weight, drug);

    // Phase 5-M-2: truncate any same-drug infusion overlapping the new start.
    currentEvents = truncateOverlappingInfusions(currentEvents, drug, newStartTime);

    setEvents([...currentEvents, {
      id: Date.now(),
      drug,
      type: 'infusion',
      time: newStartTime,
      rate: standardRate,
      originalRate: parseFloat(infusionRate), // Save original input for editing
      originalUnit: infusionUnit,
      duration: isInfiniteDuration ? (simDuration - newStartTime + 60) : parseFloat(infusionDuration),
      isInfinite: isInfiniteDuration
    }]);
    setEditingId(null);
  };

  // QuickEntry-only bolus add: takes drug+amount+time directly so it's independent of the
  // detailed-edit form's bolusAmount/bolusTime state. Handles the same isClockMode backward
  // shift logic as addBolus, and switches drug if the chip differs from current.
  const quickAddBolus = (drugArg, amountVal, timeArg) => {
    if (drugArg !== drug) setDrug(drugArg);

    let newTime = timeArg;
    let currentEvents = [...events];

    if (isClockMode && newTime < 0) {
      const offset = -newTime;
      const [sh, sm] = startTime.split(':').map(Number);
      let totalStartMin = sh * 60 + sm - offset;
      if (totalStartMin < 0) totalStartMin += 24 * 60;
      const newH = Math.floor(totalStartMin / 60);
      const newM = totalStartMin % 60;
      setStartTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
      currentEvents = currentEvents.map((e) => ({ ...e, time: e.time + offset }));
      newTime = 0;
    }

    setEvents([...currentEvents, { id: Date.now(), drug: drugArg, type: 'bolus', time: newTime, amount: amountVal }]);
    setLastDoseByDrug((prev) => ({ ...prev, [drugArg]: { ...prev[drugArg], bolusAmount: amountVal } }));
    setEditingId(null);
  };

  const quickAddInfusion = (drugArg, rateVal, unitArg, timeArg, durationVal, infinite) => {
    if (drugArg !== drug) setDrug(drugArg);

    let newStartTime = timeArg;
    let currentEvents = [...events];

    if (isClockMode && newStartTime < 0) {
      const offset = -newStartTime;
      const [sh, sm] = startTime.split(':').map(Number);
      let totalStartMin = sh * 60 + sm - offset;
      if (totalStartMin < 0) totalStartMin += 24 * 60;
      const newH = Math.floor(totalStartMin / 60);
      const newM = totalStartMin % 60;
      setStartTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
      currentEvents = currentEvents.map((e) => ({ ...e, time: e.time + offset }));
      newStartTime = 0;
    }

    const standardRate = convertToStandardUnit(rateVal, unitArg, patient.weight, drugArg);
    // Phase 5-M-2: truncate any same-drug infusion overlapping the new start.
    currentEvents = truncateOverlappingInfusions(currentEvents, drugArg, newStartTime);
    setEvents([
      ...currentEvents,
      {
        id: Date.now(),
        drug: drugArg,
        type: 'infusion',
        time: newStartTime,
        rate: standardRate,
        originalRate: rateVal,
        originalUnit: unitArg,
        duration: infinite ? Math.max(0, simDuration - newStartTime + 60) : durationVal,
        isInfinite: infinite,
      },
    ]);
    setLastDoseByDrug((prev) => ({
      ...prev,
      [drugArg]: {
        ...prev[drugArg],
        infusionRate: rateVal,
        infusionUnit: unitArg,
        infusionDuration: durationVal,
        isInfinite: infinite,
      },
    }));
    setEditingId(null);
  };

  // Phase 5-H-3 (A): manual startTime change in clock mode preserves each event's absolute
  // wall-clock time by shifting event.time by the inverse delta. Without this, moving the
  // chart origin from 10:42 to 11:00 would silently push every drug event 18 min later in
  // absolute time (the user's original input was at 11:12, not 11:30).
  const handleStartTimeChange = (newStartTime) => {
    if (!isClockMode || newStartTime === startTime) {
      setStartTime(newStartTime);
      return;
    }
    const toMin = (s) => {
      const [h, m] = s.split(':').map(Number);
      return h * 60 + m;
    };
    const oldMin = toMin(startTime);
    const newMin = toMin(newStartTime);
    let delta = oldMin - newMin; // origin moved earlier → +, later → −
    // 24h wrap: pick the smaller absolute shift (23:00 → 01:00 means "+2h", not "−22h")
    if (delta > 12 * 60) delta -= 24 * 60;
    if (delta < -12 * 60) delta += 24 * 60;
    if (delta !== 0) {
      setEvents((prev) => prev.map((e) => ({ ...e, time: e.time + delta })));
    }
    setStartTime(newStartTime);
  };

  // Phase 5-H-3 (B): find an existing event near a clicked minute on the chart so that the
  // popover can open in edit mode instead of always adding a new event. Drug filter is used
  // by SedationChart (drug-locked) but is null/undefined for the main chart.
  const findEventNearMinute = (eventList, minute, drugFilter) => {
    return eventList.find((ev) => {
      if (drugFilter && (ev.drug || drug) !== drugFilter) return false;
      if (ev.type === 'bolus') return Math.abs(ev.time - minute) <= 1;
      if (ev.type === 'infusion') {
        const endTime = ev.isInfinite ? simDuration : ev.time + ev.duration;
        return minute >= ev.time - 1 && minute <= endTime + 1;
      }
      return false;
    });
  };

  // Phase 5-H-7: hit-test for the infusion **end** marker (◀) only — drives the
  // duration-drag mode. ±2 min tolerance (slightly wider than the start ±1) so the
  // narrow end-marker is easier to grab; isInfinite events never have an end marker
  // so they're excluded.
  const findInfusionEndNearMinute = (eventList, minute, drugFilter) => {
    return eventList.find((ev) => {
      if (drugFilter && (ev.drug || drug) !== drugFilter) return false;
      if (ev.type !== 'infusion' || ev.isInfinite) return false;
      const endTime = ev.time + ev.duration;
      return Math.abs(endTime - minute) <= 2;
    });
  };

  // Phase 5-H-3 (B): event update / delete — driven by ChartEventPopover when in edit mode.
  // Update keeps the original id so list ordering and saved-trace identity remain stable.
  // The popover passes raw user-entered values; this handler does the same standard-unit
  // conversion that quickAddInfusion does so the simulation engine sees consistent data.
  const handleEventUpdate = (oldId, data) => {
    setEvents((prev) => prev.map((ev) => {
      if (ev.id !== oldId) return ev;
      if (data.type === 'bolus') {
        return { id: oldId, drug: data.drug, type: 'bolus', time: data.time, amount: data.amount };
      }
      const standardRate = convertToStandardUnit(data.rate, data.unit, patient.weight, data.drug);
      return {
        id: oldId,
        drug: data.drug,
        type: 'infusion',
        time: data.time,
        rate: standardRate,
        originalRate: data.rate,
        originalUnit: data.unit,
        duration: data.isInfinite ? Math.max(0, simDuration - data.time + 60) : data.duration,
        isInfinite: data.isInfinite,
      };
    }));
  };
  const handleEventDelete = (eventId) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
  };

  // Phase 5-H-4: time-only event update used by drag-to-reschedule. Skips the unit
  // conversion in handleEventUpdate (rate stays in standard unit) — only the time
  // changes, so the simulation engine sees an otherwise-identical event.
  const handleEventTimeChange = (eventId, newTime) => {
    setEvents((prev) => prev.map((ev) =>
      ev.id === eventId ? { ...ev, time: newTime } : ev
    ));
  };

  // Phase 5-H-7: duration-only event update used by drag-on-end-marker. Same shape
  // as handleEventTimeChange but writes the duration field. Minimum 1 min so the
  // event doesn't collapse to a zero-length artifact.
  const handleEventDurationChange = (eventId, newDuration) => {
    setEvents((prev) => prev.map((ev) =>
      ev.id === eventId ? { ...ev, duration: Math.max(1, newDuration) } : ev
    ));
  };

  // Phase 5-H-4: drag-to-reschedule on the main chart.
  // Pointer Events unify mouse + touch. The chart wrapper claims pointer capture on
  // pointerdown so subsequent moves/up are guaranteed to land here even if the
  // pointer drifts off the chart. We hit-test by reusing findEventNearMinute on the
  // px→minute conversion that already powers the iOS touch fallback. Live updates
  // call setEvents on each pointermove; Recharts re-renders the marker and curves.
  const DRAG_THRESHOLD_PX = 5;
  const SUPPRESS_CLICK_MS = 500;
  const pxToMinuteMain = (xPx, rectWidth) => {
    const PLOT_LEFT = 60;
    const PLOT_RIGHT_OFFSET = 10 + (activeDrugs.size > 0 ? 40 : 0);
    if (xPx < PLOT_LEFT || xPx > rectWidth - PLOT_RIGHT_OFFSET) return null;
    const xRatio = (xPx - PLOT_LEFT) / (rectWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET);
    return Math.max(0, Math.min(simDuration, Math.round(xRatio * simDuration)));
  };
  const onChartPointerDown = (e) => {
    const rect = chartWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const minute = pxToMinuteMain(x, rect.width);
    if (minute === null) return;
    // Phase 5-H-7: end-marker takes priority. Wider tolerance (±2) so the thin ◀
    // is grabbable; if the user is in the middle of a long infusion they fall
    // through to whole-event drag below.
    const endHit = findInfusionEndNearMinute(events, minute);
    if (endHit) {
      dragStateRef.current = {
        eventId: endHit.id,
        pointerId: e.pointerId,
        startX: x,
        startMinute: minute,
        originalTime: endHit.time,
        originalDuration: endHit.duration,
        mode: 'duration',
        didDrag: false,
      };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }
    const nearby = findEventNearMinute(events, minute);
    if (!nearby) return;
    dragStateRef.current = {
      eventId: nearby.id,
      pointerId: e.pointerId,
      startX: x,
      startMinute: minute,
      originalTime: nearby.time,
      originalDuration: nearby.duration,
      mode: 'time',
      didDrag: false,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const onChartPointerMove = (e) => {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    const rect = chartWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    if (!ds.didDrag) {
      if (Math.abs(x - ds.startX) < DRAG_THRESHOLD_PX) return;
      ds.didDrag = true;
    }
    const currentMinute = pxToMinuteMain(x, rect.width);
    if (currentMinute === null) return;
    const delta = currentMinute - ds.startMinute;
    if (ds.mode === 'duration') {
      const newDuration = Math.max(1, ds.originalDuration + delta);
      setEvents((prev) => prev.map((ev) =>
        ev.id === ds.eventId ? { ...ev, duration: newDuration } : ev
      ));
    } else {
      const newTime = Math.max(0, Math.min(simDuration, ds.originalTime + delta));
      setEvents((prev) => prev.map((ev) =>
        ev.id === ds.eventId ? { ...ev, time: newTime } : ev
      ));
    }
  };
  const onChartPointerUp = (e) => {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    if (ds.didDrag) dragEndTimeRef.current = Date.now();
    dragStateRef.current = null;
  };
  const onChartPointerCancel = (e) => {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    if (ds.didDrag) {
      const revertField = ds.mode === 'duration' ? 'duration' : 'time';
      const revertValue = ds.mode === 'duration' ? ds.originalDuration : ds.originalTime;
      setEvents((prev) => prev.map((ev) =>
        ev.id === ds.eventId ? { ...ev, [revertField]: revertValue } : ev
      ));
    }
    dragStateRef.current = null;
  };

  // Phase 5-C: drug switch is now non-destructive — events stay because they're tagged per-drug,
  // and savedTraces from other drugs are no longer dropped. We only reset the detail-edit form's
  // defaults so it makes sense for the newly selected drug.
  const handleDrugChange = (eOrStr) => {
    const newDrug = typeof eOrStr === 'string' ? eOrStr : eOrStr.target.value;
    if (newDrug === drug) return;

    setDrug(newDrug);

    const isPeds = patient.age < 12;
    const defs = CLINICAL_DEFAULTS[newDrug];

    if (defs) {
      const estimatedBolus = estimateBolus(newDrug, patient.weight);
      setBolusAmount(estimatedBolus);

      const defaultUnit = DRUG_UNITS[newDrug] ? DRUG_UNITS[newDrug][0] : 'mcg/hr';
      let newRate = defs.rate;

      const isWeightBasedUnit = defaultUnit.includes('/kg');

      if (!isWeightBasedUnit && isPeds) {
        if (newDrug === 'Morphine') newRate = patient.weight * 0.03;
        if (newDrug === 'Hydromorphone') newRate = patient.weight * 0.005;
        if (newDrug === 'Methadone') newRate = 0;
        if (newDrug === 'Fentanyl') newRate = patient.weight * 1.0;
      }

      setInfusionRate(parseFloat(newRate.toPrecision(1)));
      setInfusionDuration(defs.duration);
      setIsInfiniteDuration(true);
      setInfusionUnit(defaultUnit);
    }
    setIsAutoY(true);
    setEditingId(null);
  };

  const editEvent = (evt) => {
    // If this event belongs to a different drug, switch the editor to it (non-destructively —
    // we don't run handleDrugChange so the form-defaults reset doesn't clobber evt.amount).
    const evtDrug = evt.drug || drug;
    if (evtDrug !== drug) setDrug(evtDrug);

    const remainingEvents = events.filter((e) => e.id !== evt.id);
    setEvents(remainingEvents);

    if (evt.type === 'bolus') {
      setBolusAmount(evt.amount);
      setBolusTime(evt.time);
      setEditingId('bolus');
    } else {
      const drugForUnit = evtDrug;
      if (evt.originalRate && evt.originalUnit && DRUG_UNITS[drugForUnit]?.includes(evt.originalUnit)) {
        setInfusionRate(evt.originalRate);
        setInfusionUnit(evt.originalUnit);
      } else {
        setInfusionRate(evt.rate);
      }
      setInfusionStartTime(evt.time);
      setInfusionDuration(evt.duration);
      setIsInfiniteDuration(!!evt.isInfinite);
      setEditingId('infusion');
    }
  };

  const saveCurrentTrace = () => {
    const name = `${drug} (${model.split(' ')[0]})`;
    // Prevent duplicates: Remove existing trace with same name before adding new one
    const prevTraces = savedTraces.filter(t => t.name !== name);

    const trace = {
      id: Date.now(),
      name: name,
      data: simData,
      color: getRandomColor(),
      drug: drug
    };
    setSavedTraces([...prevTraces, trace]);
  };

  const compareAllModels = () => {
    const modelsToCompare = AVAILABLE_MODELS[drug];
    const newTraces = [];

    // Phase 5-C: filter to current editor drug's events only — multi-drug events shouldn't
    // appear in a "compare all models for current drug" view.
    const drugEvents = events.filter((e) => (e.drug || drug) === drug);
    const proc = processEvents(drugEvents, simDuration);

    modelsToCompare.forEach((m, index) => {
      const params = getPKParameters(drug, m, patient);
      const data = simulateConcentration(proc, params, simDuration, drug);

      const colors = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6'];
      const color = colors[index % colors.length];

      newTraces.push({
        id: Date.now() + index,
        name: `${drug} (${m.split(' ')[0]})`,
        data: data,
        color: color,
        drug: drug
      });
    });

    // Prevent duplicates: Remove existing traces that are about to be added
    const newNames = new Set(newTraces.map(t => t.name));
    setSavedTraces(prev => [...prev.filter(t => !newNames.has(t.name)), ...newTraces]);
  };

  const clearTraces = () => setSavedTraces([]);
  const removeTrace = (id) => setSavedTraces(savedTraces.filter(t => t.id !== id));
  const getRandomColor = () => ['#10b981', '#8b5cf6', '#f59e0b', '#64748b', '#ef4444'][Math.floor(Math.random() * 5)];

  // --- SCENARIO SAVE/RESTORE HANDLERS ---
  // Phase 5-L-1: saveScenario now supports overwrite. If overwriteId is given, the
  // matching entry is updated in place (timestamp + data); otherwise a new entry is
  // pushed to the head. The newly-saved scenario becomes the "current" one so a
  // subsequent overwrite-save acts on the same row.
  const saveScenario = (overwriteId = null, customName = null) => {
    const autoName = `${drug} - ${patient.age}y ${patient.gender} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    const data = {
      patient: { ...patient },
      drug,
      model,
      events: [...events],
      autoFillStats,
      simDuration,
      startTime: isClockMode ? startTime : null,
    };
    if (overwriteId != null) {
      setSavedScenarios(prev => prev.map(s => s.id === overwriteId
        ? { ...s, name: customName ?? s.name, timestamp: Date.now(), data }
        : s
      ));
      setIsModified(false);
      return;
    }
    const id = Date.now();
    const scenario = { id, name: customName ?? autoName, timestamp: id, data };
    setSavedScenarios(prev => [scenario, ...prev]);
    setCurrentScenarioId(id);
    setIsModified(false);
  };

  const loadScenario = (scenario) => {
    const d = scenario.data;
    setPatient(d.patient);
    setDrug(d.drug);
    // Timeout to allow drug effect to clear traces first, then set model
    // However, React batching might handle it. We'll set model directly.
    // The drug change effect clears traces, which Is desired. 
    // If the saved scenario was the SAME drug, we might lose traces we wanted to keep? 
    // User said "temporarily save... even if I change patient/drug".
    // So restoring should probably restore the exact state.
    // Setting drug triggers the "clear traces" effect. 
    // We might want to allow that to happen to simulate a fresh start.

    // We need to ensure model is set AFTER drug change effect might reset it.
    // But since `model` is a dependency of simulation, setting it here is fine.
    // The auto-selector in useEffect depends on drug/age. We need to bypass it or ensure it settles.
    // The current auto-select logic runs on [drug, patient.age].
    // If we set state here, the effect will run. 
    // We can just rely on the fact that if the saved model is valid, it will be kept or re-selected.
    // But to be safe, we might need a small timeout or just accept the auto-select logic might override if invalid.
    // Assuming saved state was valid:
    setModel(d.model);

    setEvents(d.events);
    setAutoFillStats(d.autoFillStats);
    setSimDuration(d.simDuration);
    if (d.startTime) {
      setIsClockMode(true);
      setStartTime(d.startTime);
    }
    // Phase 5-L-1: track that this scenario is now the "current" one for overwrite.
    setCurrentScenarioId(scenario.id);
    setIsModified(false);
  };

  const deleteScenario = (id) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
    // Phase 5-L-1: clear "current" pointer if the deleted entry was the loaded one.
    if (currentScenarioId === id) {
      setCurrentScenarioId(null);
      setIsModified(false);
    }
  };


  const getDoseUnit = () => CLINICAL_DEFAULTS[drug]?.unit || 'mcg';
  // Phase 5-J-4: literature-default range, possibly overridden per-drug. The
  // overrides only affect the displayed band + AUC band-clipping; respiratoryRisk
  // is literature-only by design.
  // Phase 5-M: derive the chart's reference range from the primary drug, not
  // necessarily the drug being edited. This makes the reference areas track the
  // chartClass mode (opioid → analgesia band; sedative → bisTarget / sedationBands).
  const currentRange = useMemo(() => {
    const def = THERAPEUTIC_RANGES[primaryDrugForChart];
    const ov = therapeuticOverrides[primaryDrugForChart];
    if (!ov) return def;
    return { ...def, ...ov };
  }, [primaryDrugForChart, therapeuticOverrides]);

  // Phase 5-M: display unit + divisor for the chart's Y axis. Opioid mode is
  // always ng/mL / 1; sedative mode follows the primary drug's DRUG_DISPLAY
  // (Propofol/Remimazolam use mcg/mL with divisor 1000; Ketamine/Dex stay ng/mL).
  const chartDisplay = useMemo(() => {
    const dd = DRUG_DISPLAY[primaryDrugForChart] || { unit: 'ng/mL', divisor: 1 };
    if (chartClass === 'sedative') return { unit: dd.unit, divisor: dd.divisor || 1 };
    return { unit: 'ng/mL', divisor: 1 };
  }, [primaryDrugForChart, chartClass]);

  const handleScaleChange = (newMax) => {
    setMaxTimeScale(newMax);
    if (simDuration > newMax) {
      setSimDuration(newMax);
    }
  };

  const QUICK_PRESETS = [
    {
      id: 'adult-induction-fent',
      labelKey: 'presetAdultInduction',
      drug: 'Fentanyl',
      bolus: { perKg: 2 },
    },
    {
      id: 'peds-induction-fent',
      labelKey: 'presetPedsInduction',
      drug: 'Fentanyl',
      bolus: { perKg: 1 },
    },
    {
      id: 'tiva-remi',
      labelKey: 'presetTivaMaintenance',
      drug: 'Remifentanil',
      bolus: { perKg: 1 },
      infusion: { rate: 0.25, unit: 'mcg/kg/min', isInfinite: true },
    },
    {
      id: 'icu-fent',
      labelKey: 'presetIcuSedation',
      drug: 'Fentanyl',
      infusion: { rate: 1, unit: 'mcg/kg/hr', isInfinite: true },
    },
    {
      id: 'pca-morphine',
      labelKey: 'presetPcaMorphine',
      drug: 'Morphine',
      bolus: { perKg: 0.05 },
      infusion: { rate: 0.01, unit: 'mg/kg/hr', isInfinite: true },
    },
  ];

  const applyPreset = (preset) => {
    if (events.length > 0) {
      if (!window.confirm(t('confirmReset'))) return;
    }

    if (preset.drug !== drug) {
      setDrug(preset.drug);
    }

    const newEvents = [];
    let nextId = Date.now();
    if (preset.bolus) {
      const amount = parseFloat((preset.bolus.perKg * patient.weight).toPrecision(2));
      newEvents.push({ id: nextId++, drug: preset.drug, type: 'bolus', time: 0, amount });
    }
    if (preset.infusion) {
      const stdRate = convertToStandardUnit(preset.infusion.rate, preset.infusion.unit, patient.weight, preset.drug);
      newEvents.push({
        id: nextId++,
        drug: preset.drug,
        type: 'infusion',
        time: 0,
        rate: stdRate,
        originalRate: preset.infusion.rate,
        originalUnit: preset.infusion.unit,
        duration: preset.infusion.duration ?? Math.max(0, simDuration + 60),
        isInfinite: preset.infusion.isInfinite || false,
      });
    }
    setEvents(newEvents);
    setEditingId(null);
    setIsAutoY(true);
  };

  const handleInfusionUnitChange = (newUnit) => {
    // Convert current rate to new unit to maintain same absolute dose
    const currentStd = convertToStandardUnit(parseFloat(infusionRate), infusionUnit, patient.weight, drug);
    const newRateVal = convertFromStandardUnit(currentStd, newUnit, patient.weight, drug);

    // For unit conversion, we want to be accurate but clean.
    // If we use strict 1 sig digit here, jumping between units might cause large drifts.
    // e.g. 10 -> 0.166 -> 0.2 -> 12. 
    // User asked "number in box becomes same amount". This implies accuracy.
    // But they ALSO asked "auto input dose 1 sig digit".
    // I will use slightly more precision for conversion (2 sig digits) to keep stability, 
    // unless the value is very round.
    // Let's try 2 significant digits for stability.
    setInfusionRate(parseFloat(newRateVal.toPrecision(2)));
    setInfusionUnit(newUnit);
  };

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-800 text-slate-800 font-sans dark:bg-slate-950 dark:text-slate-100"
      style={{ paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}
    >

      <TopBar
        t={t}
        i18n={i18n}
        showRanges={showRanges}
        setShowRanges={setShowRanges}
        patient={patient}
        setPatient={setPatient}
        autoFillStats={autoFillStats}
        setAutoFillStats={setAutoFillStats}
        savedScenarios={savedScenarios}
        saveScenario={saveScenario}
        loadScenario={loadScenario}
        deleteScenario={deleteScenario}
        currentScenarioId={currentScenarioId}
        isModified={isModified}
        lastSavedAt={lastSavedAt}
        isDark={isDark}
        setIsDark={setIsDark}
      />

      <main
        className="max-w-5xl mx-auto space-y-4 py-3"
        style={{
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        }}
      >

        <QuickEntry
          drug={drug}
          setDrug={handleDrugChange}
          patient={patient}
          isClockMode={isClockMode}
          startTime={startTime}
          currentSimMinutes={currentSimMinutes}
          drugList={Object.keys(DRUG_UNITS)}
          drugUnits={DRUG_UNITS}
          drugShortNames={DRUG_SHORT_NAMES}
          clinicalDefaults={CLINICAL_DEFAULTS}
          lastDoseByDrug={lastDoseByDrug}
          quickAddBolus={quickAddBolus}
          quickAddInfusion={quickAddInfusion}
          t={t}
        />

        {/* --- MAIN CHART SECTION --- */}
        <div className="bg-white dark:bg-slate-900 p-2 md:p-4 rounded-xl shadow border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap justify-between items-center mb-2 gap-x-4 gap-y-2">
            <div>
              <h2 className="font-bold text-slate-700 dark:text-slate-200 text-lg">{t('chartTitle')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                {t('chartLegend')}
              </p>
            </div>

            {/* Phase 5-J-1: Y-axis controls. Mode select replaces the binary Auto Y checkbox
                so users can pick between Full (data-peak fit), Therapeutic (band-priority
                default), or Custom (slider-driven). Slider stays visible but disabled outside
                Custom so the relationship between control and effect is obvious. */}
            {/* Phase 5-M: chartClass toggle — opioid / sedative. Auto-estimated
                from active drugs; clicking either button records a manual override
                that sticks until the user toggles again. */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-0.5" title={t('chartClassTooltip')}>
              <button
                type="button"
                onClick={() => handleChartClassToggle('opioid')}
                className={`px-2 py-0.5 text-[11px] rounded transition ${chartClass === 'opioid'
                  ? 'bg-blue-500 text-white font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              >
                {t('chartClassOpioid')}
              </button>
              <button
                type="button"
                onClick={() => handleChartClassToggle('sedative')}
                className={`px-2 py-0.5 text-[11px] rounded transition ${chartClass === 'sedative'
                  ? 'bg-teal-500 text-white font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              >
                {t('chartClassSedative')}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <ZoomIn className="w-3 h-3 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
              <select
                value={yAxisMode}
                onChange={(e) => setYAxisMode(e.target.value)}
                className="text-[11px] border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="full">{t('yModeFull')}</option>
                <option value="therapeutic">{t('yModeTherapeutic')}</option>
                <option value="custom">{t('yModeCustom')}</option>
              </select>
              <input
                type="range" min="1" max="150" step="1"
                value={Math.sqrt(yAxisMax) * 10}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const newMax = (val / 10) ** 2;
                  setYAxisMax(Math.round(newMax * 10) / 10);
                  setYAxisMode('custom');
                }}
                className={`w-24 md:w-32 accent-pink-500 ${yAxisMode === 'custom' ? 'opacity-100' : 'opacity-50'}`}
              />
              <span className="text-[11px] font-mono w-24 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                {(() => {
                  // Phase 5-M: show Y-max in the chartClass's display unit.
                  const raw = yAxisMode === 'custom' ? yAxisMax : calculatedYMax;
                  const shown = chartDisplay.divisor === 1 ? raw : raw / chartDisplay.divisor;
                  return `${shown < 10 ? shown.toFixed(2) : shown.toFixed(1)} ${chartDisplay.unit}`;
                })()}
              </span>
            </div>

            {/* Phase 5-J-4: inline therapeutic-range override (analgesia band only) for the
                current opioid. Shown only when the drug declares an analgesia band, so it
                stays out of the way for sedatives. respiratoryRisk is intentionally NOT
                editable — it's a safety value that should track literature. */}
            {currentRange?.analgesiaMin != null && currentRange?.analgesiaMax != null && (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{t('rangeLabel')}</span>
                <input
                  type="number" step="0.1" min="0"
                  value={currentRange.analgesiaMin}
                  onChange={(e) => setTherapeuticOverrides((prev) => ({
                    ...prev,
                    [drug]: { ...(prev[drug] || {}), analgesiaMin: Number(e.target.value), analgesiaMax: prev[drug]?.analgesiaMax ?? currentRange.analgesiaMax },
                  }))}
                  className="w-12 text-right border border-slate-300 dark:border-slate-600 rounded p-0.5 font-mono bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                />
                <span className="text-slate-400">—</span>
                <input
                  type="number" step="0.1" min="0"
                  value={currentRange.analgesiaMax}
                  onChange={(e) => setTherapeuticOverrides((prev) => ({
                    ...prev,
                    [drug]: { ...(prev[drug] || {}), analgesiaMax: Number(e.target.value), analgesiaMin: prev[drug]?.analgesiaMin ?? currentRange.analgesiaMin },
                  }))}
                  className="w-12 text-right border border-slate-300 dark:border-slate-600 rounded p-0.5 font-mono bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                />
                {therapeuticOverrides[drug] && (
                  <>
                    <button
                      onClick={() => setTherapeuticOverrides((prev) => {
                        const next = { ...prev };
                        delete next[drug];
                        return next;
                      })}
                      className="text-slate-500 dark:text-slate-400 hover:text-blue-600 p-0.5"
                      title={t('rangeRevertTooltip')}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <span className="text-amber-700 dark:text-amber-300 text-[9px] font-bold">{t('customRange')}</span>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={saveCurrentTrace}
                className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded shadow hover:bg-emerald-700 text-sm transition-colors"
              >
                <Save className="w-4 h-4" />
                {t('addToCompare')}
              </button>
              <button
                onClick={compareAllModels}
                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded shadow hover:bg-blue-700 text-sm transition-colors"
                title={t('compareAllTooltip')}
              >
                <Layers className="w-4 h-4" />
                {t('compareAll')}
              </button>
              {savedTraces.length > 0 && (
                <button
                  onClick={clearTraces}
                  className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded hover:bg-slate-300 text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('clear')}
                </button>
              )}
            </div>
          </div>

          <div
            className="h-[400px] w-full relative cursor-pointer"
            style={{ touchAction: 'pan-y' }}
            ref={chartWrapperRef}
            onPointerDown={onChartPointerDown}
            onPointerMove={onChartPointerMove}
            onPointerUp={onChartPointerUp}
            onPointerCancel={onChartPointerCancel}
            onTouchEnd={(e) => {
              // Phase 5-H-4: a drag that just ended would otherwise re-open the popover
              // via this iOS fallback or the Recharts onClick below — suppress for 500ms.
              if (Date.now() - dragEndTimeRef.current < SUPPRESS_CLICK_MS) return;
              // iOS Safari fallback: Recharts' SVG onClick is unreliable on touch.
              // Decode the tap location → minute manually using approximate plot-area
              // boundaries (left YAxis ~60, right Burden ~40 when active + 10 margin).
              if (chartPopover.open) return;
              if (!e.changedTouches || e.changedTouches.length === 0) return;
              const t = e.changedTouches[0];
              const rect = chartWrapperRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = t.clientX - rect.left;
              const y = t.clientY - rect.top;
              const PLOT_LEFT = 60;
              const PLOT_RIGHT_OFFSET = 10 + (activeDrugs.size > 0 ? 40 : 0);
              if (x < PLOT_LEFT || x > rect.width - PLOT_RIGHT_OFFSET) return;
              const xRatio = (x - PLOT_LEFT) / (rect.width - PLOT_LEFT - PLOT_RIGHT_OFFSET);
              const minute = Math.max(0, Math.min(simDuration, Math.round(xRatio * simDuration)));
              const nearbyEvent = findEventNearMinute(events, minute);
              setChartPopover({ open: true, x, y, minute, editingEventId: nearbyEvent?.id ?? null });
            }}
          >
            {/* Phase 5-J-1: peak-exceeds indicator. Visible only when the data peak is
                clipped by Therapeutic / Custom modes — Full always shows the peak. */}
            {yAxisInfo.dataPeak > calculatedYMax && yAxisInfo.dataPeak > 0 && (
              <div className="absolute top-2 left-16 z-10 text-[10px] font-mono bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5 pointer-events-none shadow-sm">
                {t('peakExceedsRange', { value: yAxisInfo.dataPeak.toFixed(1), unit: 'ng/mL', time: yAxisInfo.peakTime })}
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                onClick={(e) => {
                  // Phase 5-H-4: suppress the click that follows a drag release.
                  if (Date.now() - dragEndTimeRef.current < SUPPRESS_CLICK_MS) return;
                  if (e && e.activeLabel != null && e.chartX != null && e.chartY != null) {
                    const minute = Math.max(0, Math.round(Number(e.activeLabel)));
                    const nearbyEvent = findEventNearMinute(events, minute);
                    setChartPopover({
                      open: true,
                      x: e.chartX,
                      y: e.chartY,
                      minute,
                      editingEventId: nearbyEvent?.id ?? null,
                    });
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[xAxisMin, simDuration]}
                  tickCount={10}
                  allowDataOverflow
                  tickFormatter={(val) => isClockMode ? minutesToTime(val, startTime) : (timeZeroMinute > 0 ? (val - timeZeroMinute) : val)}
                  stroke={chartColors.axisStroke}
                />
                <YAxis
                  yAxisId="left"
                  label={{ value: `Conc (${chartDisplay.unit})`, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: chartColors.axisStroke } }}
                  domain={[0, calculatedYMax]}
                  allowDataOverflow={true}
                  tickFormatter={(v) => chartDisplay.divisor === 1 ? v : (v / chartDisplay.divisor).toFixed(v / chartDisplay.divisor < 1 ? 2 : 1)}
                  stroke={chartColors.axisStroke}
                />
                {/* Right Y-axis: fractional respiratory depression R/(1+R), Hill γ=1.
                    Phase 5-J-3.1 — domain shrunk from [0, 2.5] to [0, 1.0] and ticks
                    displayed as % so the curve reads as "% resp depression".
                    Phase 5-M: hidden in sedative mode (Burden Index is opioid-only;
                    Bouillon synergy will provide the sedative-included version later). */}
                {activeDrugs.size > 0 && chartClass === 'opioid' && (
                  <YAxis
                    yAxisId="burden"
                    orientation="right"
                    domain={[0, 1.0]}
                    ticks={[0, 0.25, 0.5, 0.75, 1.0]}
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    stroke={chartColors.axisStroke}
                    label={{ value: 'Resp Dep', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: chartColors.axisStroke }, fontSize: 11 }}
                    width={48}
                  />
                )}
                {isClockMode && currentSimMinutes !== null && currentSimMinutes >= 0 && currentSimMinutes <= simDuration && (
                  <ReferenceLine yAxisId="left" x={currentSimMinutes} stroke="#ef4444" strokeDasharray="3 3" />
                )}

                <Tooltip
                  contentStyle={{ background: chartColors.tooltipBg, color: chartColors.tooltipText, border: `1px solid ${chartColors.tooltipBorder}` }}
                  content={
                    <ChartTooltip
                      events={events}
                      isClockMode={isClockMode}
                      startTime={startTime}
                      timeZeroMinute={timeZeroMinute}
                    />
                  }
                />
                <Legend verticalAlign="top" height={36} />

                {/* Therapeutic Windows — overlay set depends on chartClass.
                    Phase 5-M: opioid mode keeps the existing analgesia + resp-risk
                    overlay. Sedative mode renders the drug-specific bisTarget band
                    (Propofol / Remimazolam) or sedationBands set (Dex) or
                    experimentalReferenceLine (Ketamine), porting the logic that
                    used to live in SedationChart.jsx. */}
                {showRanges && currentRange && chartClass === 'opioid' && currentRange.analgesiaMin != null && (
                  <>
                    <ReferenceArea
                      yAxisId="left"
                      y1={currentRange.analgesiaMin}
                      y2={currentRange.analgesiaMax}
                      fill="#4ade80"
                      fillOpacity={0.15}
                    />
                    <ReferenceLine
                      yAxisId="left"
                      y={currentRange.analgesiaMax}
                      stroke="#16a34a"
                      strokeDasharray="3 3"
                      label={{ value: t('analgesiaMax'), position: 'insideTopRight', fill: '#166534', fontSize: 10 }}
                    />
                    <ReferenceLine
                      yAxisId="left"
                      y={currentRange.analgesiaMin}
                      stroke="#16a34a"
                      strokeDasharray="3 3"
                      label={{ value: t('analgesiaMin'), position: 'insideBottomRight', fill: '#166534', fontSize: 10 }}
                    />
                    {currentRange.respiratoryRisk != null && (
                      <>
                        <ReferenceArea
                          yAxisId="left"
                          y1={currentRange.respiratoryRisk}
                          y2={9999}
                          fill="#ef4444"
                          fillOpacity={0.05}
                        />
                        <ReferenceLine
                          yAxisId="left"
                          y={currentRange.respiratoryRisk}
                          stroke="#ef4444"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          label={{ value: `${t('respRisk')} ${currentRange.respiratoryRisk}`, position: 'insideTopLeft', fill: '#dc2626', fontSize: 11, fontWeight: 'bold' }}
                        />
                      </>
                    )}
                  </>
                )}
                {showRanges && currentRange && chartClass === 'sedative' && currentRange.bisTarget && (
                  <>
                    <ReferenceArea
                      yAxisId="left"
                      y1={currentRange.bisTarget.min}
                      y2={currentRange.bisTarget.max}
                      fill="#3b82f6"
                      fillOpacity={0.15}
                    />
                    {/* Phase 5-M-1: the band represents the Ce range that, in the
                        literature, corresponds to BIS 40-60 (general anaesthesia).
                        Labels show min + max in the chart's display unit so it's
                        obvious this is a concentration band, not a BIS-number band. */}
                    <ReferenceLine
                      yAxisId="left"
                      y={currentRange.bisTarget.max}
                      stroke="#2563eb"
                      strokeDasharray="3 3"
                      label={{
                        value: `${t('bisTargetUpper')} ${(currentRange.bisTarget.max / chartDisplay.divisor).toFixed(2)} ${chartDisplay.unit}`,
                        position: 'insideTopRight', fill: '#1d4ed8', fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      yAxisId="left"
                      y={currentRange.bisTarget.min}
                      stroke="#2563eb"
                      strokeDasharray="3 3"
                      label={{
                        value: `${t('bisTargetLower')} ${(currentRange.bisTarget.min / chartDisplay.divisor).toFixed(2)} ${chartDisplay.unit}`,
                        position: 'insideBottomRight', fill: '#1d4ed8', fontSize: 10,
                      }}
                    />
                  </>
                )}
                {showRanges && currentRange && chartClass === 'sedative' && Array.isArray(currentRange.sedationBands) && currentRange.sedationBands.map((band, idx) => (
                  <ReferenceArea
                    key={`sedband-${idx}`}
                    yAxisId="left"
                    y1={band.min}
                    y2={band.max}
                    fill={band.color || '#6366f1'}
                    fillOpacity={0.12}
                    label={{ value: band.label, position: 'insideRight', fill: '#4338ca', fontSize: 10 }}
                  />
                ))}
                {showRanges && currentRange && chartClass === 'sedative' && currentRange.experimentalReferenceLine != null && (
                  <ReferenceLine
                    yAxisId="left"
                    y={currentRange.experimentalReferenceLine}
                    stroke="#7c3aed"
                    strokeDasharray="4 2"
                    label={{ value: `Heat-pain ref (${currentRange.experimentalReferenceLine} ng/mL)`, position: 'insideTopLeft', fill: '#6d28d9', fontSize: 10 }}
                  />
                )}

                {/* DOSING EVENT MARKERS — coloured by the event's drug */}
                {events.flatMap((evt) => {
                  const evtDrug = evt.drug || drug;
                  const shortName = DRUG_SHORT_NAMES[evtDrug] || evtDrug;
                  const colors = DRUG_COLORS[evtDrug] || { ce: '#a855f7', cp: '#fed7aa' };
                  const evtUnit = getDoseUnitForDrug(evtDrug);
                  if (evt.type === 'bolus') {
                    const bolusText = `${shortName} ${evt.amount}${evtUnit}`;
                    return [
                      <ReferenceLine
                        key={`evt-bolus-${evt.id}`}
                        yAxisId="left"
                        x={evt.time}
                        stroke={colors.ce}
                        strokeWidth={1.5}
                        strokeDasharray="2 3"
                        ifOverflow="extendDomain"
                      >
                        <Label value="▼" position="top" fill={colors.ce} fontSize={13} fontWeight="bold" offset={2} />
                        <Label value={bolusText} position="insideTopLeft" fill={colors.ce} fontSize={11} fontWeight="bold" offset={4} />
                      </ReferenceLine>
                    ];
                  }
                  if (evt.type === 'infusion') {
                    const endTime = evt.isInfinite ? simDuration : evt.time + evt.duration;
                    const rateText = evt.originalRate && evt.originalUnit
                      ? `${evt.originalRate} ${evt.originalUnit}`
                      : `${evt.rate}/hr`;
                    const inflText = `▶ ${shortName} ${rateText}`;
                    return [
                      <ReferenceArea
                        key={`evt-inf-area-${evt.id}`}
                        yAxisId="left"
                        x1={evt.time}
                        x2={endTime}
                        fill={colors.cp}
                        fillOpacity={0.18}
                        ifOverflow="hidden"
                      />,
                      <ReferenceLine
                        key={`evt-inf-start-${evt.id}`}
                        yAxisId="left"
                        x={evt.time}
                        stroke={colors.ce}
                        strokeWidth={1.5}
                        strokeDasharray="3 2"
                        ifOverflow="extendDomain"
                      >
                        <Label value={inflText} position="insideTopLeft" fill={colors.ce} fontSize={10} fontWeight="bold" offset={4} dy={18} />
                      </ReferenceLine>,
                      !evt.isInfinite && (
                        <ReferenceLine
                          key={`evt-inf-end-${evt.id}`}
                          yAxisId="left"
                          x={endTime}
                          stroke={colors.ce}
                          strokeWidth={1}
                          strokeDasharray="3 2"
                          ifOverflow="hidden"
                        >
                          <Label value="◀" position="insideTopRight" fill={colors.ce} fontSize={11} offset={4} dy={18} />
                        </ReferenceLine>
                      )
                    ].filter(Boolean);
                  }
                  return [];
                })}

                {/* SAVED TRACES — comparison overlays from "Add to Compare" / Compare All */}
                {savedTraces.map((trace) => (
                  <Line
                    key={trace.id}
                    yAxisId="left"
                    data={trace.data}
                    type="monotone"
                    dataKey="ce"
                    name={`[Comp] ${trace.name}`}
                    stroke={trace.color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}

                {/* CURRENT SIMULATION — one Cp + Ce pair per active drug, drug-coloured.
                    Phase 5-M: this loop iterates plotDrugs, which is activeOpioids in
                    opioid mode and activeSedatives in sedative mode. The chart Y axis
                    is in ng/mL internally; each line divides by its drug's display
                    divisor when chartClass='sedative' (so mcg/mL drugs display in mcg). */}
                {plotDrugs.flatMap((d) => {
                  const sim = simByDrug.get(d);
                  if (!sim || sim.length === 0) return [];
                  const colors = DRUG_COLORS[d] || { ce: '#ec4899', cp: '#3b82f6' };
                  const shortName = DRUG_SHORT_NAMES[d] || d;
                  // Phase 5-M: chart Y axis is ng/mL internally for all drugs; the
                  // tickFormatter handles divisor conversion to mcg/mL when needed.
                  // Don't pre-divide here — that would put the line at the wrong
                  // y-coordinate relative to ReferenceAreas (which are in ng/mL too).
                  const displayUnit = chartDisplay.unit;
                  const displaySim = sim;
                  const unitTag = displayUnit === 'ng/mL' ? '' : ` ${displayUnit}`;
                  return [
                    <Line
                      key={`cp-${d}`}
                      yAxisId="left"
                      data={displaySim}
                      type="monotone"
                      dataKey="cp"
                      name={`Cp ${shortName}${unitTag}`}
                      stroke={colors.cp}
                      strokeWidth={2}
                      strokeOpacity={0.6}
                      strokeDasharray="4 2"
                      dot={false}
                      isAnimationActive={false}
                    />,
                    <Line
                      key={`ce-${d}`}
                      yAxisId="left"
                      data={displaySim}
                      type="monotone"
                      dataKey="ce"
                      name={`Ce ${shortName}${unitTag}`}
                      stroke={colors.ce}
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />,
                  ];
                })}

                {/* OPIOID RESPIRATORY DEPRESSION FRACTION — R/(1+R) where R = Σ Ce/RespC50.
                    Phase 5-J-3.1: instantaneous fractional resp depression (Hill γ=1).
                    Phase 5-M: hidden in sedative mode — the right axis itself isn't
                    rendered, and the burden series is opioid-only anyway. */}
                {activeDrugs.size > 0 && chartClass === 'opioid' && showBurdenCurve && (
                  <>
                    <ReferenceLine
                      yAxisId="burden"
                      y={0.5}
                      stroke="#dc2626"
                      strokeDasharray="2 2"
                      label={{ value: '50% Dep', position: 'right', fill: '#dc2626', fontSize: 10 }}
                    />
                    <Line
                      yAxisId="burden"
                      data={burdenSeries}
                      type="monotone"
                      dataKey="burden"
                      name="Opioid Burden"
                      stroke="#475569"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </>
                )}

              </LineChart>
            </ResponsiveContainer>

            {
              isClockMode && currentValues && currentSimMinutes >= 0 && currentSimMinutes <= simDuration && (
                <div className="absolute top-2 right-14 bg-white/90 dark:bg-slate-800/90 p-2 rounded shadow border border-red-200 dark:border-red-900/50 text-xs pointer-events-none">
                  <div className="font-bold text-red-600 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    {t('now')} ({currentTime.getHours().toString().padStart(2, '0')}:{currentTime.getMinutes().toString().padStart(2, '0')})
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 mt-1 text-slate-600 dark:text-slate-300">
                    <span>Cp:</span> <span className="font-mono font-bold">{currentValues.cp}</span>
                    <span>Ce:</span> <span className="font-mono font-bold">{currentValues.ce}</span>
                  </div>
                </div>
              )
            }

            {/* Phase 5-H-1: chart-click popover. Anchored to chart wrapper (position: relative).
                Reuses the existing quickAddBolus / quickAddInfusion handlers — no new business
                logic. Outside-click + Escape close inside the component. */}
            {chartPopover.open && (
              <ChartEventPopover
                open
                onClose={() => setChartPopover((p) => ({ ...p, open: false }))}
                position={{ x: chartPopover.x, y: chartPopover.y }}
                containerSize={{
                  w: chartWrapperRef.current?.clientWidth || 0,
                  h: chartWrapperRef.current?.clientHeight || 0,
                }}
                initialMinute={chartPopover.minute}
                initialDrug={drug}
                drugList={Object.keys(DRUG_UNITS)}
                drugUnits={DRUG_UNITS}
                drugShortNames={DRUG_SHORT_NAMES}
                clinicalDefaults={CLINICAL_DEFAULTS}
                lastDoseByDrug={lastDoseByDrug}
                isClockMode={isClockMode}
                startTime={startTime}
                quickAddBolus={quickAddBolus}
                quickAddInfusion={quickAddInfusion}
                editingEvent={chartPopover.editingEventId
                  ? events.find((ev) => ev.id === chartPopover.editingEventId)
                  : null}
                onUpdate={handleEventUpdate}
                onDelete={handleEventDelete}
                t={t}
              />
            )}
          </div>

          {/* Phase 5-M: SedationChart mini-charts were removed. Sedative drugs now
              render on the same main chart via the chartClass toggle (see below). */}

          {/* Axis Controls */}
          <div className="flex flex-col sm:flex-row justify-end mt-2 gap-4 items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
            {/* Time Axis Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 whitespace-nowrap">{t('timeAxis')}</span>
              <label className="flex items-center gap-1 text-xs cursor-pointer select-none bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded hover:bg-slate-300 transition-colors mr-2">
                <Clock className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                <input
                  type="checkbox"
                  checked={isClockMode}
                  onChange={(e) => {
                    setIsClockMode(e.target.checked);
                    if (e.target.checked) {
                      const now = new Date();
                      const h = String(now.getHours()).padStart(2, '0');
                      const m = String(now.getMinutes()).padStart(2, '0');
                      setStartTime(`${h}:${m}`);
                    }
                  }}
                  className="accent-blue-600 w-3 h-3"
                />
                <span className="font-semibold text-slate-600 dark:text-slate-300">{t('clockMode')}</span>
              </label>

              {
                isClockMode && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="text-xs border border-slate-300 dark:border-slate-600 rounded p-1 mr-2"
                  />
                )
              }

              {/* Phase 5-J-2: time-zero (any event or sim start) for relative X-axis labels.
                  Mutually exclusive with clock mode — clock mode owns absolute time. */}
              {!isClockMode && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{t('timeZero')}:</span>
                  <select
                    value={timeZeroMinute}
                    onChange={(e) => setTimeZeroMinute(Number(e.target.value))}
                    className="text-[11px] border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <option value={0}>{t('timeZeroNone')}</option>
                    {events.map((ev) => {
                      const short = DRUG_SHORT_NAMES[ev.drug || drug] || (ev.drug || drug);
                      const evtUnit = getDoseUnitForDrug(ev.drug || drug);
                      const label = ev.type === 'bolus'
                        ? `▼ ${short} ${ev.amount}${evtUnit} @ ${ev.time}min`
                        : `▶ ${short} ${ev.originalRate ?? ev.rate}${ev.originalUnit ? ` ${ev.originalUnit}` : '/hr'} @ ${ev.time}min`;
                      return <option key={ev.id} value={ev.time}>{label}</option>;
                    })}
                  </select>
                  {timeZeroMinute > 0 && (
                    <button
                      onClick={() => setTimeZeroMinute(0)}
                      className="text-slate-500 dark:text-slate-400 hover:text-blue-600 p-0.5"
                      title={t('timeZeroResetTooltip')}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}


              <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5">
                {[360, 720, 1440].map((scale) => (
                  <button
                    key={scale}
                    onClick={() => handleScaleChange(scale)}
                    className={`text-[10px] px-2 py-1 rounded ${maxTimeScale === scale ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                  >
                    {scale === 360 ? '6h' : scale === 720 ? '12h' : '24h'}
                  </button>
                ))}
              </div>

              <input
                type="range" min={Math.sqrt(30)} max={Math.sqrt(maxTimeScale)} step="0.1"
                value={Math.sqrt(simDuration)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const newDuration = Math.round(val ** 2);
                  // Snap to nearest 10 to keep it clean
                  setSimDuration(Math.round(newDuration / 10) * 10);
                }}
                className="w-20 md:w-32 accent-slate-600"
              />

              {/* Phase 5-J-4: explicit X-min input. Default 0; negative useful only with
                  timeZeroMinute (e.g. show -30..+90 around an event). */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{t('xAxisMin')}</span>
                <input
                  type="number"
                  min="-1440"
                  max={Math.max(0, simDuration - 30)}
                  value={xAxisMin}
                  onChange={(e) => setXAxisMin(Number(e.target.value))}
                  className="w-14 text-right text-xs border border-slate-300 dark:border-slate-600 rounded p-1 font-mono focus:ring-1 focus:ring-blue-400 outline-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  title={t('xAxisMinTooltip')}
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{t('xAxisMax')}</span>
                <input
                  type="number"
                  min="10"
                  max="2880"
                  value={simDuration}
                  onChange={(e) => setSimDuration(Number(e.target.value))}
                  className="w-16 text-right text-xs border border-slate-300 dark:border-slate-600 rounded p-1 pr-1 font-mono focus:ring-1 focus:ring-blue-400 outline-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* Phase 5-J-4: master display reset — restores axes / time-zero / mode /
                  burden visibility / therapeutic overrides. Does NOT touch events,
                  patient, or drug selection. */}
              <button
                onClick={() => {
                  setYAxisMode('therapeutic');
                  setYAxisMax(6);
                  setXAxisMin(0);
                  setSimDuration(120);
                  setMaxTimeScale(720);
                  setTimeZeroMinute(0);
                  setShowBurdenCurve(true);
                  setShowBurdenInfo(false);
                  setTherapeuticOverrides({});
                }}
                className="text-[10px] px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center gap-1"
                title={t('resetDisplayTooltip')}
              >
                <RotateCcw className="w-3 h-3" />
                {t('resetDisplay')}
              </button>
            </div>
          </div >

          {
            savedTraces.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {savedTraces.map(t => (
                  <div key={t.id} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-xs border border-slate-200 dark:border-slate-700">
                    <div className="w-2 h-2 rounded-full" style={{ background: t.color }}></div>
                    <span className="font-medium">{t.name}</span>
                    <button onClick={() => removeTrace(t.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )
          }
        </div >

        {/* --- SUMMARY METRICS ---
            Phase 5-L-2: each card has an ⓘ button that toggles a help popover
            spanning the full grid row, explaining the definition + caveats of
            that metric in plain language.
            Phase 5-L-3: when clock-mode is active, Peak/Onset cards show the
            absolute wall-clock time *and* the elapsed minutes, e.g.
            "@09:23 (+12 min)" — relative-only was confusing in clinical use. */}
        {summaryMetrics && simData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <SummaryCard
              accent="pink"
              label={t('summaryPeakCe')}
              value={(summaryMetrics.peakCe.value / summaryMetrics.displayDivisor).toFixed(2)}
              footer={isClockMode
                ? `${summaryMetrics.displayUnit} ${t('summaryAt')} ${minutesToTime(summaryMetrics.peakCe.time, startTime)} (+${summaryMetrics.peakCe.time}${t('summaryMin')})`
                : `${summaryMetrics.displayUnit} ${t('summaryAt')} ${summaryMetrics.peakCe.time}${t('summaryMin')}`}
              helpKey="peak"
              helpText={t('summaryPeakCeHelp')}
              openId={summaryHelpOpen}
              setOpenId={setSummaryHelpOpen}
              t={t}
            />

            <SummaryCard
              accent="emerald"
              label={summaryMetrics.isSedative ? 'BIS Onset' : t('summaryOnset')}
              value={summaryMetrics.onsetTime !== null
                ? (isClockMode
                    ? minutesToTime(summaryMetrics.onsetTime, startTime)
                    : `${summaryMetrics.onsetTime}`)
                : '—'}
              footer={summaryMetrics.onsetTime !== null
                ? (isClockMode
                    ? `+${summaryMetrics.onsetTime}${t('summaryMin')} (Ce ≥ ${summaryMetrics.onsetThreshold})`
                    : `${t('summaryMin')} (Ce ≥ ${summaryMetrics.onsetThreshold})`)
                : t('summaryNotReached')}
              helpKey="onset"
              helpText={summaryMetrics.isSedative ? t('summaryBisOnsetHelp') : t('summaryOnsetHelp')}
              openId={summaryHelpOpen}
              setOpenId={setSummaryHelpOpen}
              t={t}
            />

            <SummaryCard
              accent="red"
              label={summaryMetrics.isSedative ? 'Deep sedation' : t('summaryRespRisk')}
              value={summaryMetrics.respRiskMin}
              footer={summaryMetrics.respRiskThreshold != null
                ? `${t('summaryMin')} (Ce ≥ ${summaryMetrics.respRiskThreshold})`
                : '—'}
              helpKey="resp"
              helpText={summaryMetrics.isSedative ? t('summaryDeepSedationHelp') : t('summaryRespRiskHelp')}
              openId={summaryHelpOpen}
              setOpenId={setSummaryHelpOpen}
              t={t}
            />

            <SummaryCard
              accent="purple"
              label={summaryMetrics.recoveryTime !== null ? t('summaryRecovery') : t('summaryTotalDose')}
              value={summaryMetrics.recoveryTime !== null
                ? summaryMetrics.recoveryTime
                : summaryMetrics.totalDose.toFixed(summaryMetrics.totalDose < 1 ? 2 : 1)}
              footer={summaryMetrics.recoveryTime !== null
                ? `${t('summaryMin')} after stop`
                : summaryMetrics.drugUnit}
              helpKey="recovery"
              helpText={summaryMetrics.recoveryTime !== null ? t('summaryRecoveryHelp') : t('summaryTotalDoseHelp')}
              openId={summaryHelpOpen}
              setOpenId={setSummaryHelpOpen}
              t={t}
            />

            {summaryHelpOpen && (
              <div className="col-span-2 md:col-span-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {(() => {
                  // Map openId back to the right help text for display in the row-spanning panel.
                  if (summaryHelpOpen === 'peak') return t('summaryPeakCeHelp');
                  if (summaryHelpOpen === 'onset') return summaryMetrics.isSedative ? t('summaryBisOnsetHelp') : t('summaryOnsetHelp');
                  if (summaryHelpOpen === 'resp') return summaryMetrics.isSedative ? t('summaryDeepSedationHelp') : t('summaryRespRiskHelp');
                  if (summaryHelpOpen === 'recovery') return summaryMetrics.recoveryTime !== null ? t('summaryRecoveryHelp') : t('summaryTotalDoseHelp');
                  return null;
                })()}
              </div>
            )}
          </div>
        )}

        {/* Phase 5-L-4: rule-based clinical alerts strip. Sits between summary
            cards and the AUC panel so it competes for the same vertical real
            estate as the numbers it's interpreting. */}
        {activeOpioids.length > 0 && simData.length > 0 && (
          <ClinicalAlerts alerts={clinicalAlerts} t={t} />
        )}

        {/* Phase 5-J-3: Opioid Burden (cumulative AUC) summary panel.
            Distinct from the right-axis instantaneous risk curve — see lib/burden.js. */}
        {activeOpioids.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-1">
                {t('opioidBurden')}
                <button
                  type="button"
                  onClick={() => setShowBurdenInfo((v) => !v)}
                  className="text-slate-400 dark:text-slate-500 hover:text-blue-600 p-0.5 rounded"
                  title={t('opioidBurden')}
                  aria-expanded={showBurdenInfo}
                >
                  <Info className="w-3 h-3" />
                </button>
              </h3>
              <label className="text-[10px] flex items-center gap-1 cursor-pointer text-slate-600 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={showBurdenCurve}
                  onChange={(e) => setShowBurdenCurve(e.target.checked)}
                  className="accent-blue-600 w-3 h-3"
                />
                {t('burdenCurveToggle')}
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide">{t('burdenTotal')}</div>
                <div className="text-base font-mono font-bold text-slate-700 dark:text-slate-200 leading-tight">{burdenAUC.total.toFixed(0)}</div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500">ng/mL·min</div>
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">{t('burdenTherapeutic')}</div>
                <div className="text-base font-mono font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{burdenAUC.therapeutic.toFixed(0)}</div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500">ng/mL·min</div>
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-red-600 dark:text-red-400 tracking-wide">{t('burdenSupra')}</div>
                <div className="text-base font-mono font-bold text-red-700 dark:text-red-300 leading-tight">{burdenAUC.supra.toFixed(0)}</div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500">ng/mL·min</div>
              </div>
            </div>
            {showBurdenInfo && (
              <div className="mt-2 text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 leading-relaxed">
                {t('burdenTooltip')}
              </div>
            )}
          </div>
        )}

        {/* --- CONTROLS SECTION --- */}
        < div className="grid grid-cols-1 lg:grid-cols-12 gap-4" >

          {/* Left Column: Patient & Model (4 cols) */}
          < div className="lg:col-span-4 space-y-4" >
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3 text-emerald-600 border-b pb-2">
                <Settings className="h-4 w-4" />
                <h3 className="font-bold text-sm">{t('drugModelSelection')}</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs">{t('drug')}</label>
                    {/* Phase 5-K-2: literature reference modal trigger. */}
                    <button
                      onClick={() => setReferenceModalOpen(true)}
                      className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5 rounded flex items-center gap-0.5"
                      title={t('viewLiteratureTooltip')}
                      aria-label={t('viewLiteratureTooltip')}
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase tracking-wide">{t('viewLiteratureLabel')}</span>
                    </button>
                  </div>
                  <select value={drug} onChange={handleDrugChange} className="w-full border rounded p-2 font-medium bg-emerald-50 text-emerald-900 border-emerald-200">
                    <optgroup label={t('optgroupOpioids')}>
                      <option value="Fentanyl">Fentanyl (mcg)</option>
                      <option value="Remifentanil">Remifentanil (mcg)</option>
                      <option value="Morphine">Morphine (mg)</option>
                      <option value="Hydromorphone">Hydromorphone (mg)</option>
                      <option value="Methadone">Methadone (mg)</option>
                      <option value="Sufentanil">Sufentanil (mcg)</option>
                    </optgroup>
                    <optgroup label={t('optgroupSedatives')}>
                      <option value="Propofol">Propofol (mg)</option>
                      <option value="Remimazolam">Remimazolam (mg)</option>
                      <option value="Ketamine">Ketamine (mg, S-form)</option>
                      <option value="Dexmedetomidine">Dexmedetomidine (mcg)</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-xs block mb-1">{t('pkModel')}</label>
                  <select value={model} onChange={e => setModel(e.target.value)} className="w-full border rounded p-2">
                    {/* Phase 5-H-5: explicit value attrs keep state-matching stable across languages.
                        Only the localisable Adult/Pediatric descriptors are translated; author
                        names, years, and population qualifiers (Peds/Adult, PICU, Neonate, S-form)
                        stay as international identifiers per user direction (minimal i18n scope). */}
                    {drug === 'Fentanyl' && <>
                      <option value="Bae (2020) Adult">Bae (2020) {t('modelDescAdult')}</option>
                      <option value="Shafer (Adult)">Shafer ({t('modelDescAdult')})</option>
                      <option value="Ginsberg (Pediatric)">Ginsberg ({t('modelDescPediatric')})</option>
                      <option value="Scott (Peds/Adult)">Scott (Peds/Adult)</option>
                    </>}
                    {drug === 'Remifentanil' && <>
                      <option value="Minto (Adult)">Minto ({t('modelDescAdult')})</option>
                      <option value="Rigby-Jones (Pediatric)">Rigby-Jones ({t('modelDescPediatric')})</option>
                    </>}
                    {drug === 'Morphine' && <>
                      <option value="Mazoit (2007) Adult">Mazoit (2007) {t('modelDescAdult')}</option>
                      <option value="Bouwmeester (2004) Pediatric">Bouwmeester (2004) {t('modelDescPediatric')}</option>
                      <option value="Anand (2008) Neonate">Anand (2008) Neonate</option>
                    </>}
                    {drug === 'Hydromorphone' && <>
                      <option value="Jeleazcov (2014) Adult">Jeleazcov (2014) {t('modelDescAdult')}</option>
                      <option value="Balyan (2020) Pediatric">Balyan (2020) {t('modelDescPediatric')}</option>
                      <option value="Standard (Adult)">Standard ({t('modelDescAdult')})</option>
                      <option value="Pediatric (Scaled)">{t('modelDescPediatric')} (Scaled)</option>
                    </>}
                    {drug === 'Methadone' && <>
                      <option value="Standard (Adult)">Standard ({t('modelDescAdult')})</option>
                    </>}
                    {drug === 'Sufentanil' && <>
                      <option value="Gepts (1995) Adult">Gepts (1995) {t('modelDescAdult')}</option>
                      <option value="Bartkowska-Sniatkowska (2016) PICU">Bartkowska-Sniatkowska (2016) PICU</option>
                    </>}
                    {drug === 'Propofol' && <>
                      <option value="Eleveld (2018) General-purpose">Eleveld (2018) General-purpose</option>
                    </>}
                    {drug === 'Remimazolam' && <>
                      <option value="Eleveld (2025) Adult">Eleveld (2025) {t('modelDescAdult')}</option>
                    </>}
                    {drug === 'Ketamine' && <>
                      <option value="Noppers (2011) S-ketamine">Noppers (2011) S-ketamine</option>
                    </>}
                    {drug === 'Dexmedetomidine' && <>
                      <option value="Hannivoort (2015) Adult">Hannivoort (2015) {t('modelDescAdult')}</option>
                    </>}
                  </select>
                </div>

                {/* Model Params Display */}
                {parameters && (
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-2 bg-slate-50 dark:bg-slate-800 p-1 rounded">
                    <span>V1:{parameters.V1.toFixed(1)}L</span>
                    <span>Cl:{parameters.Cl.toFixed(2)}L/m</span>
                    <span>ke0:{parameters.ke0}</span>
                  </div>
                )}
                {model.includes('Pediatric') && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 bg-blue-50 p-1.5 rounded">
                    <Baby className="w-3 h-3" />
                    <span>{t('pediatricModelActive')}</span>
                  </div>
                )}
                {drug === 'Morphine' && (
                  null
                )}
              </div>
            </div>

          </div >

          {/* Right Column: Dosing & History (8 cols) */}
          < div className="lg:col-span-8 space-y-4" >
            {/* Dosing Inputs */}
            < div className="grid grid-cols-1 md:grid-cols-2 gap-4" >
              <div className={`p-4 rounded-xl shadow-sm border transition-colors ${editingId === 'bolus' ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center gap-2 mb-3 text-purple-600">
                  <Syringe className="h-4 w-4" />
                  <h3 className="font-bold text-sm">
                    {editingId === 'bolus' ? t('bolusEditing') : t('bolusDose')}
                  </h3>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">{t('dose')} ({getDoseUnit()})</label>
                    <input type="number" min="0" value={bolusAmount} onChange={e => setBolusAmount(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 h-10 text-lg font-bold text-center text-purple-700" />
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold flex justify-between items-center mb-0.5">
                      <span>{t('time')}</span>
                      <button
                        onClick={() => setBolusTime(isClockMode && currentSimMinutes !== null ? currentSimMinutes : 0)}
                        className="text-[9px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-0.5 ml-1 transition-colors"
                        title={t('now')}
                      >
                        {t('now')}
                      </button>
                    </label>
                    {isClockMode ? (
                      <input
                        type="time"
                        value={minutesToTime(bolusTime, startTime)}
                        onChange={e => setBolusTime(timeToMinutes(e.target.value, startTime))}
                        className="w-full border rounded px-1 h-10 text-center text-sm"
                      />
                    ) : (
                      <input type="number" min="0" value={bolusTime} onChange={e => setBolusTime(Math.max(0, Number(e.target.value)))} className="w-full border rounded px-1 h-10 text-center" />
                    )}
                    {isClockMode && (
                      <div className="flex gap-px mt-0.5">
                        <button onClick={() => setBolusTime(Math.max(0, (currentSimMinutes ?? bolusTime) - 30))} className="flex-1 text-[8px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">{t('minus30m')}</button>
                        <button onClick={() => setBolusTime(Math.max(0, (currentSimMinutes ?? bolusTime) - 60))} className="flex-1 text-[8px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">{t('minus1h')}</button>
                        <button onClick={() => setBolusTime(Math.max(0, (currentSimMinutes ?? bolusTime) - 120))} className="flex-1 text-[8px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">{t('minus2h')}</button>
                      </div>
                    )}
                  </div>
                  <button onClick={addBolus} className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg shadow active:scale-95 transition-transform">
                    {editingId === 'bolus' ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className={`p-4 rounded-xl shadow-sm border transition-colors ${editingId === 'infusion' ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center gap-2 mb-3 text-orange-600">
                  <Clock className="h-4 w-4" />
                  <h3 className="font-bold text-sm">
                    {editingId === 'infusion' ? t('infusionEditing') : t('infusion')}
                  </h3>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold flex justify-between">
                      <span>{t('rate')}</span>
                      <select
                        value={infusionUnit}
                        onChange={e => handleInfusionUnitChange(e.target.value)}
                        className="text-[9px] border-none bg-transparent p-0 text-right pr-4 font-mono text-slate-500 dark:text-slate-400 dark:text-slate-500 cursor-pointer focus:ring-0 outline-none"
                        style={{ textAlignLast: 'right' }}
                      >
                        {DRUG_UNITS[drug]?.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </label>
                    <input type="number" min="0" value={infusionRate} onChange={e => setInfusionRate(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 h-10 text-lg font-bold text-center text-orange-700" />
                  </div>
                  <div className="w-16">
                    <label className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold flex justify-between items-center mb-0.5">
                      <span>{t('start')}</span>
                      <button
                        onClick={() => setInfusionStartTime(isClockMode && currentSimMinutes !== null ? currentSimMinutes : 0)}
                        className="text-[9px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-0.5 -mr-1 transition-colors"
                        title={t('now')}
                      >
                        {t('now')}
                      </button>
                    </label>
                    {isClockMode ? (
                      <input
                        type="time"
                        value={minutesToTime(infusionStartTime, startTime)}
                        onChange={e => setInfusionStartTime(timeToMinutes(e.target.value, startTime))}
                        className="w-full border rounded px-1 h-10 text-center text-sm"
                      />
                    ) : (
                      <input type="number" min="0" value={infusionStartTime} onChange={e => setInfusionStartTime(Math.max(0, Number(e.target.value)))} className="w-full border rounded px-1 h-10 text-center" />
                    )}
                    {isClockMode && (
                      <div className="flex gap-px mt-0.5">
                        <button onClick={() => setInfusionStartTime(Math.max(0, (currentSimMinutes ?? infusionStartTime) - 30))} className="flex-1 text-[8px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">{t('minus30m')}</button>
                        <button onClick={() => setInfusionStartTime(Math.max(0, (currentSimMinutes ?? infusionStartTime) - 60))} className="flex-1 text-[8px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">{t('minus1h')}</button>
                        <button onClick={() => setInfusionStartTime(Math.max(0, (currentSimMinutes ?? infusionStartTime) - 120))} className="flex-1 text-[8px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">{t('minus2h')}</button>
                      </div>
                    )}
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold flex flex-col">
                      <span>{t('duration')}</span>
                      <label className="flex items-center gap-0.5 cursor-pointer">
                        <input type="checkbox" checked={isInfiniteDuration} onChange={e => setIsInfiniteDuration(e.target.checked)} className="accent-orange-600 w-3 h-3" />
                        <span className="text-[9px] normal-case whitespace-nowrap text-slate-600 dark:text-slate-300">{t('indefinite')}</span>
                      </label>
                    </label>
                    {isInfiniteDuration ? (
                      <div className="w-full border rounded px-1 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 text-xl flex items-center justify-center h-10">∞</div>
                    ) : (
                      isClockMode ? (
                        <input
                          type="time"
                          value={minutesToTime(infusionStartTime + infusionDuration, startTime)}
                          onChange={e => {
                            let endMin = timeToMinutes(e.target.value, startTime);
                            let dur = endMin - infusionStartTime;
                            if (dur < 0) dur += 1440;
                            setInfusionDuration(dur);
                          }}
                          className="w-full border rounded px-1 h-10 text-center text-sm"
                        />
                      ) : (
                        <input type="number" min="0" value={infusionDuration} onChange={e => setInfusionDuration(Math.max(0, Number(e.target.value)))} className="w-full border rounded px-1 h-10 text-center" />
                      )
                    )}
                  </div>
                  <button onClick={addInfusion} className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-lg shadow active:scale-95 transition-transform">
                    {editingId === 'infusion' ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div >

            {/* Event List */}
            < div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden" >
              <div className="bg-slate-50 dark:bg-slate-800 p-2 px-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-600 dark:text-slate-300">{t('currentSchedule')}</h3>
                <button onClick={() => setEvents([])} className="text-xs text-red-500 hover:underline">{t('clearAll')}</button>
              </div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {events.length === 0 && <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-xs">{t('noHistory')}</div>}
                {events.sort((a, b) => a.time - b.time).map(evt => {
                  const evtDrug = evt.drug || drug;
                  const evtUnit = getDoseUnitForDrug(evtDrug);
                  const evtShort = DRUG_SHORT_NAMES[evtDrug] || evtDrug;
                  const evtColors = DRUG_COLORS[evtDrug] || { ce: '#a855f7' };
                  return (
                  <div key={evt.id} className="p-2 px-4 flex justify-between items-center text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <div className="flex items-center gap-3">
                      {evt.type === 'bolus' ? <Syringe className="w-4 h-4" style={{ color: evtColors.ce }} /> : <Activity className="w-4 h-4" style={{ color: evtColors.ce }} />}
                      <span className="text-[10px] font-bold rounded px-1.5 py-0.5" style={{ backgroundColor: evtColors.ce + '22', color: evtColors.ce }}>{evtShort}</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 dark:text-slate-500 w-12 text-right">{evt.time} min</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {evt.type === 'bolus' ? `${t('bolusLabel')}: ${evt.amount} ${evtUnit}` :
                          `${t('infusionLabel')}: ${evt.originalRate || evt.rate} ${evt.originalUnit || (evtUnit + '/hr')} (${evt.duration}min)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => editEvent(evt)} title={t('editTooltip')} className="text-slate-300 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setEvents(events.filter(e => e.id !== evt.id))} title={t('deleteTooltip')} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div >

          </div >
        </div >

        {/* --- QUICK PRESETS --- (relocated to bottom; rarely used in routine OR flow) */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-600">
              <Wand2 className="h-4 w-4" />
              <h3 className="font-bold text-sm">{t('presetsTitle')}</h3>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{t('presetTooltip')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {QUICK_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className="text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <div className="font-bold text-slate-700 dark:text-slate-200 leading-tight">{t(preset.labelKey)}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{preset.drug}</div>
              </button>
            ))}
          </div>
        </div>
      </main >

      {/* Phase 5-K-2: literature reference modal — mounted at root so the backdrop covers the full viewport. */}
      <TherapeuticReferenceModal
        drug={drug}
        open={referenceModalOpen}
        onClose={() => setReferenceModalOpen(false)}
      />
    </div >
  );
};

export default App;
