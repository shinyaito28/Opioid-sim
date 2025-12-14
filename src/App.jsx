
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { Syringe, Clock, Settings, User, Activity, Plus, Trash2, Save, X, Eye, EyeOff, ZoomIn, Baby, Edit2, AlertCircle, Wand2, Info, FileText, Layers, FolderOpen, Download } from 'lucide-react';


/**
 * ------------------------------------------------------------------
 * CONSTANTS & DATA
 * ------------------------------------------------------------------
 */

const THERAPEUTIC_RANGES = {
  'Fentanyl': {
    // Ref: Bae et al. BJA 2020, van Lemmen et al. 2025
    analgesiaMin: 0.5,
    analgesiaMax: 2.5,
    respiratoryRisk: 2.3,
    label: 'Analgesia (0.5-2.5) / Resp C50: 2.3'
  },
  'Remifentanil': {
    analgesiaMin: 3.0,
    analgesiaMax: 8.0,
    respiratoryRisk: 2.5,
    label: 'Surgical (3.0-8.0)'
  },
  'Morphine': {
    analgesiaMin: 10,
    analgesiaMax: 40,
    respiratoryRisk: 30,
    label: 'Analgesia (10-40)'
  },
  'Hydromorphone': {
    analgesiaMin: 4.0,
    analgesiaMax: 15.0,
    respiratoryRisk: 10.0,
    label: 'Analgesia (4.0-15.0)'
  },
  'Methadone': {
    analgesiaMin: 50,
    analgesiaMax: 100,
    respiratoryRisk: 200,
    label: 'Analgesia (50-100) / Resp Risk > 200'
  },
  'Sufentanil': {
    analgesiaMin: 0.2,
    analgesiaMax: 0.6,
    respiratoryRisk: 0.5,
    label: 'Analgesia (0.2-0.6)'
  }
};

const DRUG_UNITS = {
  'Fentanyl': ['mcg/kg/hr', 'mcg/hr'],
  'Remifentanil': ['mcg/kg/min', 'mcg/hr', 'mcg/min'],
  'Morphine': ['mg/hr', 'mg/kg/hr', 'mcg/kg/min'],
  'Hydromorphone': ['mg/hr', 'mg/kg/hr', 'mcg/kg/min'],
  'Methadone': ['mg/hr'],
  'Sufentanil': ['mcg/kg/hr', 'mcg/hr']
};

const CLINICAL_DEFAULTS = {
  'Fentanyl': { bolus: 100, rate: 1.0, duration: 60, unit: 'mcg' },
  'Remifentanil': { bolus: 0, rate: 0.25, duration: 60, unit: 'mcg' },
  'Morphine': { bolus: 5, rate: 2, duration: 120, unit: 'mg' },
  'Hydromorphone': { bolus: 1, rate: 0.5, duration: 120, unit: 'mg' },
  'Methadone': { bolus: 5, rate: 2, duration: 60, unit: 'mg' },
  'Sufentanil': { bolus: 0.1, rate: 0.3, duration: 60, unit: 'mcg' }
};

// Define available models for easy iteration
const AVAILABLE_MODELS = {
  'Fentanyl': ['Bae (2020) Adult', 'Shafer (Adult)', 'Ginsberg (Pediatric)', 'Scott (Peds/Adult)'],
  'Remifentanil': ['Minto (Adult)', 'Rigby-Jones (Pediatric)'],
  'Morphine': ['Maitre (Adult)', 'McFarlan (Pediatric)'],
  'Hydromorphone': ['Jeleazcov (2014) Adult', 'Balyan (2020) Pediatric', 'Standard (Adult)', 'Pediatric (Scaled)'],
  'Methadone': ['Standard (Adult)'],
  'Sufentanil': ['Gepts (1995) Adult', 'Bartkowska-Sniatkowska (2016) PICU']
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

const calculateLBM = (weight, height, gender) => {
  if (!height || !weight) return weight;
  if (gender === 'male') {
    return (1.1 * weight) - (128 * ((weight / height) ** 2));
  } else {
    return (1.07 * weight) - (148 * ((weight / height) ** 2));
  }
};

const getModelRequirements = (drug, model) => {
  if (drug === 'Remifentanil' && model.includes('Minto')) return ['age', 'weight', 'height', 'gender'];
  if (drug === 'Hydromorphone' && model.includes('Jeleazcov')) return ['age', 'weight'];
  if (drug === 'Fentanyl' && model.includes('Shafer')) return [];
  if (drug === 'Methadone') return ['weight'];
  if (drug === 'Sufentanil') return ['weight'];
  return ['weight'];
};

// --- BEST MODEL SELECTOR HELPER ---
const getBestModel = (drug, age) => {
  const isPeds = age < 12;
  if (drug === 'Fentanyl') return isPeds ? 'Ginsberg (Pediatric)' : 'Bae (2020) Adult';
  if (drug === 'Remifentanil') return isPeds ? 'Rigby-Jones (Pediatric)' : 'Minto (Adult)';
  if (drug === 'Morphine') return isPeds ? 'McFarlan (Pediatric)' : 'Maitre (Adult)';
  if (drug === 'Hydromorphone') return isPeds ? 'Balyan (2020) Pediatric' : 'Jeleazcov (2014) Adult';
  if (drug === 'Methadone') return 'Standard (Adult)';
  if (drug === 'Sufentanil') return isPeds ? 'Bartkowska-Sniatkowska (2016) PICU' : 'Gepts (1995) Adult';
  return 'Bae (2020) Adult';
};

const estimateBolus = (drug, weight) => {
  let dose = 0;
  if (drug === 'Fentanyl') dose = weight * 1.5;
  else if (drug === 'Remifentanil') dose = 0;
  else if (drug === 'Morphine') dose = weight * 0.1;
  else if (drug === 'Hydromorphone') dose = weight * 0.02;
  else if (drug === 'Methadone') dose = weight * 0.1;
  else if (drug === 'Sufentanil') dose = weight * 0.1; // 0.1 mcg/kg

  if (dose === 0) return 0;
  return parseFloat(dose.toPrecision(1));
};

const getPKParameters = (drug, model, patient) => {
  const { age, weight, height, gender } = patient;
  if (!weight || weight <= 0) return { V1: 1, V2: 1, V3: 0, Cl: 1, Q2: 0, Q3: 0, ke0: 0.1 };

  let params = { V1: 0, V2: 0, V3: 0, Cl: 0, Q2: 0, Q3: 0, ke0: 0 };

  // --- FENTANYL ---
  if (drug === 'Fentanyl') {
    if (model === 'Bae (2020) Adult') {
      const wRatio = weight / 70;
      params.V1 = 10.1 * (wRatio ** 1.0);
      params.V2 = 26.5 * (wRatio ** 1.0);
      params.V3 = 206.0 * (wRatio ** 1.0);
      params.Cl = 0.704 * (wRatio ** 0.75);
      params.Q2 = 2.38 * (wRatio ** 0.75);
      params.Q3 = 1.49 * (wRatio ** 0.75);
      params.ke0 = 0.147;
    } else if (model === 'Shafer (Adult)') {
      params.V1 = 15; params.V2 = 40; params.V3 = 200;
      params.Cl = 0.5; params.Q2 = 1.5; params.Q3 = 1.0;
      params.ke0 = 0.14;
    } else if (model === 'Ginsberg (Pediatric)') {
      params.V1 = 0.5 * weight; params.V2 = 1.8 * weight; params.V3 = 8.5 * weight;
      params.Cl = 0.022 * weight; params.Q2 = 0.05 * weight; params.Q3 = 0.03 * weight;
      params.ke0 = 0.16;
    } else if (model === 'Scott (Peds/Adult)') {
      const wRatio = weight / 70;
      params.V1 = 4.61 * wRatio; params.V2 = 16.9 * wRatio; params.V3 = 189 * wRatio;
      params.Cl = 0.78 * wRatio; params.Q2 = 1.25 * wRatio; params.Q3 = 0.96 * wRatio;
      params.ke0 = 0.13;
    } else {
      const wRatio = weight / 70;
      params.V1 = 10.1 * wRatio; params.V2 = 26.5 * wRatio; params.V3 = 206 * wRatio;
      params.Cl = 0.704 * (wRatio ** 0.75); params.Q2 = 2.38 * (wRatio ** 0.75); params.Q3 = 1.49 * (wRatio ** 0.75); params.ke0 = 0.147;
    }
  }
  // --- REMIFENTANIL ---
  else if (drug === 'Remifentanil') {
    if (model === 'Minto (Adult)') {
      const lbm = calculateLBM(weight, height, gender);
      const lbm_var = lbm > 0 ? lbm : weight;
      params.V1 = 5.1 - 0.0201 * (age - 40) + 0.072 * (lbm_var - 55);
      params.V2 = 9.82 - 0.0811 * (age - 40) + 0.108 * (lbm_var - 55);
      params.V3 = 5.42;
      params.Cl = 2.6 - 0.0162 * (age - 40) + 0.0191 * (lbm_var - 55);
      params.Q2 = 2.05 - 0.0301 * (age - 40);
      params.Q3 = 0.076 - 0.00113 * (age - 40);
      params.ke0 = 0.595 - 0.007 * (age - 40);
    } else if (model === 'Rigby-Jones (Pediatric)') {
      params.V1 = 0.7 * weight; params.V2 = 1.0 * weight; params.V3 = 0.7 * weight;
      params.Cl = 0.05 * weight; params.Q2 = 0.04 * weight; params.Q3 = 0.02 * weight;
      params.ke0 = 0.9;
    }
  }
  // --- MORPHINE ---
  else if (drug === 'Morphine') {
    if (model === 'McFarlan (Pediatric)') {
      params.V1 = 0.5 * weight; params.V2 = 0.9 * weight; params.V3 = 2.0 * weight;
      params.Cl = 0.03 * weight; params.Q2 = 0.06 * weight; params.Q3 = 0.015 * weight;
      params.ke0 = 0.01;
    } else if (model === 'Maitre (Adult)') {
      params.V1 = 0.2 * weight; params.V2 = 0.8 * weight; params.V3 = 2.5 * weight;
      params.Cl = 0.025 * weight; params.Q2 = 0.05 * weight; params.Q3 = 0.01 * weight;
      params.ke0 = 0.005;
    }
  }
  // --- HYDROMORPHONE ---
  else if (drug === 'Hydromorphone') {
    if (model === 'Jeleazcov (2014) Adult') {
      const wRatio = weight / 70;
      const ageFactor = Math.max(0.5, 1 - 0.01 * (age - 67));
      params.V1 = 3.35 * wRatio;
      params.V2 = 13.9 * wRatio;
      params.V3 = 145.0 * wRatio;
      params.Cl = 1.01 * (wRatio ** 0.75) * ageFactor;
      params.Q2 = 1.47 * (wRatio ** 0.75);
      params.Q3 = 1.41 * (wRatio ** 0.75);
      params.ke0 = 0.02;
    } else if (model === 'Balyan (2020) Pediatric') {
      const wRatio = weight / 70;
      params.V1 = 33.0 * (wRatio ** 1.0);
      params.V2 = 146.0 * (wRatio ** 1.0);
      params.V3 = 0;
      params.Cl = 0.748 * (wRatio ** 0.75);
      params.Q2 = 1.57 * (wRatio ** 0.75);
      params.Q3 = 0;
      params.ke0 = 0.03;
    } else if (model === 'Standard (Adult)') {
      params.V1 = 0.25 * weight; params.V2 = 0.6 * weight; params.V3 = 4.0 * weight;
      params.Cl = 0.02 * weight; params.Q2 = 0.02 * weight; params.Q3 = 0.01 * weight;
      params.ke0 = 0.02;
    } else if (model === 'Pediatric (Scaled)') {
      const wRatio = weight / 70;
      params.V1 = 17.5 * wRatio; params.V2 = 42 * wRatio; params.V3 = 280 * wRatio;
      params.Cl = 1.4 * (wRatio ** 0.75); params.Q2 = 1.4 * (wRatio ** 0.75); params.Q3 = 0.7 * (wRatio ** 0.75);
      params.ke0 = 0.03;
    } else {
      const wRatio = weight / 70;
      params.V1 = 3.35 * wRatio; params.V2 = 13.9 * wRatio; params.V3 = 145.0 * wRatio; params.Cl = 1.01 * (wRatio ** 0.75); params.Q2 = 1.47 * (wRatio ** 0.75); params.Q3 = 1.41 * (wRatio ** 0.75); params.ke0 = 0.02;
    }
  }
  // --- METHADONE ---
  else if (drug === 'Methadone') {
    // Standardized to 70kg: V1=21.5, V2=75.1, V3=484, CL=9.45 L/h, Q2=325 L/h, Q3=136 L/h
    // Converted to L/min for CL, Q2, Q3
    const wRatio = weight / 70;
    params.V1 = 21.5 * wRatio;
    params.V2 = 75.1 * wRatio;
    params.V3 = 484.0 * wRatio;
    params.Cl = (9.45 / 60) * (wRatio ** 0.75);
    params.Q2 = (325.0 / 60) * (wRatio ** 0.75);
    params.Q3 = (136.0 / 60) * (wRatio ** 0.75);
    params.ke0 = 0.05; // Estimated, slow equilibration
  }
  // --- SUFENTANIL ---
  else if (drug === 'Sufentanil') {
    if (model === 'Gepts (1995) Adult') {
      // Gepts E et al. Anesthesiology 1995; 83:1194-1204
      // V1 = 14.2 L, V2 = 40.0 L, V3 = 217 L
      // Cl = 0.94 L/min, Q2 = 1.9 L/min, Q3 = 1.1 L/min
      // Ke0 not defined in original PK paper, referencing TCI manual or similar: 0.17 approx
      params.V1 = 14.2;
      params.V2 = 40.0;
      params.V3 = 217.0;
      params.Cl = 0.94;
      params.Q2 = 1.9;
      params.Q3 = 1.1;
      params.ke0 = 0.17; // Common TCI value (e.g. Schnider/Minto range equivalent)
    } else if (model === 'Bartkowska-Sniatkowska (2016) PICU') {
      // Bartkowska-Sniatkowska A et al. Cartlidge. Paediatr Anaesth. 2016
      // PopPK in ICU children (sedation). 2-compartment.
      // Cl = 19.5 * (W/70)^0.75 L/h  => /60 for L/min
      // V1 (Vc) = 11.5 * (W/70) L
      // Q (Q2) = 15.3 * (W/70)^0.75 L/h => /60
      // V2 (Vp) = 40 * (W/70) L
      // ke0 estimated similar to adult or peds data: 0.15
      const wRatio = weight / 70;
      params.V1 = 11.5 * wRatio;
      params.V2 = 40.0 * wRatio;
      params.V3 = 0; // 2-comp
      params.Cl = (19.5 / 60) * (wRatio ** 0.75);
      params.Q2 = (15.3 / 60) * (wRatio ** 0.75);
      params.Q3 = 0;
      params.ke0 = 0.15;
    }
  }

  if (isNaN(params.V1) || params.V1 <= 0.1) params.V1 = 1.0;
  return params;
};

// --- UNIT CONVERSION HELPERS ---
const convertToStandardUnit = (rate, unit, weight, drug) => {
  // Standard Unit: mcg/hr for Fent/Remi/Sufentanil, mg/hr for Morphine/Hydro/Methadone
  const isMgDrug = ['Morphine', 'Hydromorphone', 'Methadone'].includes(drug);

  let valInMcgHr = 0;

  switch (unit) {
    case 'mcg/hr': valInMcgHr = rate; break;
    case 'mg/hr': valInMcgHr = rate * 1000; break;
    case 'mcg/kg/min': valInMcgHr = rate * weight * 60; break;
    case 'mcg/min': valInMcgHr = rate * 60; break;
    case 'mcg/kg/hr': valInMcgHr = rate * weight; break;
    case 'mg/kg/hr': valInMcgHr = rate * weight * 1000; break;
    default: valInMcgHr = rate;
  }

  if (isMgDrug) return valInMcgHr / 1000; // Return mg/hr
  return valInMcgHr; // Return mcg/hr
};


// Simulation Engine
const simulateConcentration = (events, params, durationMinutes, drugType) => {
  const { V1, V2, V3, Cl, Q2, Q3, ke0 } = params;

  if (!V1 || V1 <= 0) return [];

  const k10 = Cl / V1;
  const k12 = Q2 / V1;
  const k21 = Q2 / V2;

  const k13 = (V3 > 0) ? Q3 / V1 : 0;
  const k31 = (V3 > 0) ? Q3 / V3 : 0;

  const isMgDrug = drugType === 'Morphine' || drugType === 'Hydromorphone' || drugType === 'Methadone';
  const scaleFactor = isMgDrug ? 1000 : 1;

  let x1 = 0, x2 = 0, x3 = 0, xe = 0;
  let data = [];
  const dt = 1 / 6;

  const eventQueue = [...events].sort((a, b) => a.time - b.time);
  let eventIndex = 0;
  let currentInfusionRate = 0;

  const totalSteps = Math.floor(durationMinutes / dt);
  const stepsPerMin = Math.round(1 / dt);

  for (let step = 0; step <= totalSteps; step++) {
    const t = step * dt;

    while (eventIndex < eventQueue.length && eventQueue[eventIndex].time <= t) {
      const evt = eventQueue[eventIndex];

      if (evt.type === 'bolus') {
        x1 += evt.amount * scaleFactor;
      } else if (evt.type === 'infusion_start') {
        currentInfusionRate = (evt.rate * scaleFactor) / 60;
      } else if (evt.type === 'infusion_stop') {
        currentInfusionRate = 0;
      }

      eventIndex++;
    }

    const dx1 = (currentInfusionRate - (k10 + k12 + k13) * x1 + k21 * x2 + k31 * x3) * dt;
    const dx2 = (k12 * x1 - k21 * x2) * dt;
    const dx3 = (k13 * x1 - k31 * x3) * dt;

    let cp = x1 / V1;
    let dCe = (ke0 * (cp - xe)) * dt;

    x1 += dx1; x2 += dx2; x3 += dx3; xe += dCe;

    if (!Number.isFinite(x1)) x1 = 0;
    if (!Number.isFinite(x2)) x2 = 0;
    if (!Number.isFinite(x3)) x3 = 0;
    if (!Number.isFinite(xe)) xe = 0;

    cp = x1 / V1;

    if (step % stepsPerMin === 0) {
      data.push({
        time: Math.round(t),
        cp: Number.isFinite(cp) ? parseFloat(cp.toFixed(2)) : 0,
        ce: Number.isFinite(xe) ? parseFloat(xe.toFixed(2)) : 0,
      });
    }
  }
  return data;
};

/**
 * ------------------------------------------------------------------
 * UI COMPONENTS
 * ------------------------------------------------------------------
 */

const App = () => {
  const { t, i18n } = useTranslation();
  const [patient, setPatient] = useState({
    age: 40, weight: 60, height: 165, gender: 'male'
  });
  const [autoFillStats, setAutoFillStats] = useState(true);

  const [drug, setDrug] = useState('Fentanyl');
  const [model, setModel] = useState('Bae (2020) Adult');

  const [bolusAmount, setBolusAmount] = useState(CLINICAL_DEFAULTS['Fentanyl'].bolus);
  const [bolusTime, setBolusTime] = useState(0);
  const [infusionRate, setInfusionRate] = useState(CLINICAL_DEFAULTS['Fentanyl'].rate);
  const [infusionStartTime, setInfusionStartTime] = useState(0);
  const [infusionDuration, setInfusionDuration] = useState(60);
  const [isInfiniteDuration, setIsInfiniteDuration] = useState(true);
  const [infusionUnit, setInfusionUnit] = useState(DRUG_UNITS['Fentanyl'][0]);

  const [events, setEvents] = useState([
    { id: 1, type: 'bolus', time: 0, amount: CLINICAL_DEFAULTS['Fentanyl'].bolus }
  ]);

  const [simDuration, setSimDuration] = useState(120);
  const [maxTimeScale, setMaxTimeScale] = useState(720);

  const [simData, setSimData] = useState([]);
  const [parameters, setParameters] = useState(null);

  const [savedTraces, setSavedTraces] = useState([]);
  const [savedScenarios, setSavedScenarios] = useState([]); // SAVE/RESTORE FEATURE
  const [showRanges, setShowRanges] = useState(true);
  const [yAxisMax, setYAxisMax] = useState(6);
  const [isAutoY, setIsAutoY] = useState(true);
  const [isClockMode, setIsClockMode] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- EFFECT: Update Current Time ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);
  const [editingId, setEditingId] = useState(null);

  const activeParams = useMemo(() => getModelRequirements(drug, model), [drug, model]);

  const getFieldStyle = (paramName) => {
    if (activeParams.includes(paramName)) {
      return "bg-white border-blue-300 ring-1 ring-blue-100 text-slate-800 font-medium";
    }
    return "bg-slate-100 border-slate-200 text-slate-400 opacity-80";
  };

  const getLabelStyle = (paramName) => {
    if (activeParams.includes(paramName)) {
      return "text-blue-600 font-bold";
    }
    return "text-slate-400";
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

  // --- EFFECT: Sync Dose Time with Real Time in Clock Mode ---
  useEffect(() => {
    if (isClockMode && currentSimMinutes !== null) {
      const shouldUpdate = (prev) => {
        // Update if value is 0 (initial) or matches previous minute (tracking)
        // Allow small jitter (1-2 min) to handle update timing
        if (prev === 0) return true;
        const diff = Math.abs(prev - currentSimMinutes);
        // If difference is 0 or 1, we are tracking. 
        // We also check against (current - 1) for the transition moment.
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

  // --- EFFECT: Set Defaults on Drug Change ---
  useEffect(() => {
    const isPeds = patient.age < 12;
    const defs = CLINICAL_DEFAULTS[drug];
    if (defs) {
      const scale = isPeds ? 0.4 : 1.0;
      setBolusAmount(Math.round(defs.bolus * scale * 10) / 10);
      setInfusionRate(Math.round(defs.rate * scale * 10) / 10);
      setInfusionDuration(defs.duration);
      setIsInfiniteDuration(true);

      // Set default unit
      setInfusionUnit(DRUG_UNITS[drug] ? DRUG_UNITS[drug][0] : 'mcg/hr');
    }
    setIsAutoY(true);
    setEvents([]);
    setEditingId(null);
    setSavedTraces(prev => prev.filter(t => t.drug === drug));
  }, [drug]);

  // --- EFFECT: Run Simulation ---
  useEffect(() => {
    const params = getPKParameters(drug, model, patient);
    setParameters(params);

    let processedEvents = [];
    events.forEach(evt => {
      if (evt.type === 'bolus') {
        processedEvents.push(evt);
      } else if (evt.type === 'infusion') {
        processedEvents.push({ ...evt, type: 'infusion_start' });
        processedEvents.push({
          type: 'infusion_stop',
          time: evt.time + evt.duration,
          rate: 0
        });
      }
    });

    const data = simulateConcentration(processedEvents, params, simDuration, drug);
    setSimData(data);
  }, [patient, drug, model, events, simDuration]);

  // --- CALCULATE AUTO Y MAX ---
  // --- CALCULATE AUTO Y MAX ---
  const calculatedYMax = useMemo(() => {
    if (!isAutoY) return yAxisMax;
    let maxCe = 0;
    if (simData.length > 0) {
      maxCe = Math.max(...simData.map(d => d.ce));
    }
    savedTraces.forEach(trace => {
      if (trace.data && trace.data.length > 0) {
        const traceMax = Math.max(...trace.data.map(d => d.ce));
        if (traceMax > maxCe) maxCe = traceMax;
      }
    });
    if (maxCe <= 0) return 5;
    return Math.ceil(maxCe * 1.2);
  }, [isAutoY, yAxisMax, simData, savedTraces]);


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

    setEvents([...currentEvents, { id: Date.now(), type: 'bolus', time: newTime, amount: parseFloat(bolusAmount) }]);
    setEditingId(null);
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

    setEvents([...currentEvents, {
      id: Date.now(),
      type: 'infusion',
      time: newStartTime,
      rate: standardRate,
      originalRate: parseFloat(infusionRate), // Save original input for editing
      originalUnit: infusionUnit,
      duration: isInfiniteDuration ? (simDuration - newStartTime + 60) : parseFloat(infusionDuration)
    }]);
    setEditingId(null);
  };

  const editEvent = (evt) => {
    const remainingEvents = events.filter(e => e.id !== evt.id);
    setEvents(remainingEvents);

    if (evt.type === 'bolus') {
      setBolusAmount(evt.amount);
      setBolusTime(evt.time);
      setEditingId('bolus');
    } else {
      // Try to use original values if available, otherwise just use the rate (which is standardized)
      // If we don't have originalUnit, we might display standardized rate in default unit?
      // Simple approach: if original exists, use it. If not, assumes standard unit.
      if (evt.originalRate && evt.originalUnit && DRUG_UNITS[drug].includes(evt.originalUnit)) {
        setInfusionRate(evt.originalRate);
        setInfusionUnit(evt.originalUnit);
      } else {
        setInfusionRate(evt.rate);
        // Keep current unit or default? Default might be confusing if converted.
        // If no original info, it means it's an old event or generic.
      }
      setInfusionStartTime(evt.time);
      setInfusionDuration(evt.duration);
      setIsInfiniteDuration(false);
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

    let processedEvents = [];
    events.forEach(evt => {
      if (evt.type === 'bolus') {
        processedEvents.push(evt);
      } else if (evt.type === 'infusion') {
        processedEvents.push({ ...evt, type: 'infusion_start' });
        processedEvents.push({
          type: 'infusion_stop',
          time: evt.time + evt.duration,
          rate: 0
        });
      }
    });

    modelsToCompare.forEach((m, index) => {
      const params = getPKParameters(drug, m, patient);
      const data = simulateConcentration(processedEvents, params, simDuration, drug);

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
  const saveScenario = () => {
    const scenario = {
      id: Date.now(),
      name: `${drug} - ${patient.age}y ${patient.gender} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      timestamp: Date.now(),
      data: {
        patient: { ...patient },
        drug,
        model,
        events: [...events],
        autoFillStats,
        simDuration,
        startTime: isClockMode ? startTime : null
      }
    };
    setSavedScenarios(prev => [scenario, ...prev]);
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
  };

  const deleteScenario = (id) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
  };


  const getDoseUnit = () => CLINICAL_DEFAULTS[drug]?.unit || 'mcg';
  const currentRange = THERAPEUTIC_RANGES[drug];

  const handleScaleChange = (newMax) => {
    setMaxTimeScale(newMax);
    if (simDuration > newMax) {
      setSimDuration(newMax);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">

      {/* Header */}
      <header className="bg-slate-800 text-white p-3 shadow-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <h1 className="text-base sm:text-lg font-bold">{t('appTitle')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-700 rounded p-1 gap-1">
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
              className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded flex items-center gap-1"
            >
              {showRanges ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{t('ranges')}</span>
            </button>
            <div className="text-xs bg-red-900/50 text-red-200 px-2 py-1 rounded border border-red-800 hidden sm:block">
              {t('forResearchOnly')}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-3 space-y-4">

        {/* --- MAIN CHART SECTION --- */}
        <div className="bg-white p-2 md:p-4 rounded-xl shadow border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-2">
            <div>
              <h2 className="font-bold text-slate-700 text-lg">{t('chartTitle')}</h2>
              <p className="text-xs text-slate-500">
                {t('chartLegend')}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveCurrentTrace}
                className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded shadow hover:bg-emerald-700 text-sm transition-colors"
              >
                <Save className="w-4 h-4" />
                {t('addToCompare')}
              </button>
              <button
                onClick={saveScenario}
                className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded shadow hover:bg-indigo-700 text-sm transition-colors"
                title={t('saveScenarioTooltip')}
              >
                <FolderOpen className="w-4 h-4" />
                {t('saveCase')}
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
                  className="flex items-center gap-1 bg-slate-200 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-300 text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('clear')}
                </button>
              )}
            </div>
          </div>

          <div className="h-[400px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, simDuration]}
                  tickCount={10}
                  allowDataOverflow
                  tickFormatter={(val) => isClockMode ? minutesToTime(val, startTime) : val}
                />
                <YAxis
                  label={{ value: t('concLabel'), angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                  domain={[0, calculatedYMax]}
                  allowDataOverflow={true}
                />
                {isClockMode && currentSimMinutes !== null && currentSimMinutes >= 0 && currentSimMinutes <= simDuration && (
                  <ReferenceLine x={currentSimMinutes} stroke="#ef4444" strokeDasharray="3 3" />
                )}

                <Tooltip
                  labelFormatter={(v) => isClockMode ? `${minutesToTime(v, startTime)} (${v} min)` : `${v} min`}
                  contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                />
                <Legend verticalAlign="top" height={36} />

                {/* Therapeutic Windows */}
                {showRanges && currentRange && (
                  <>
                    <ReferenceArea
                      y1={currentRange.analgesiaMin}
                      y2={currentRange.analgesiaMax}
                      fill="#4ade80"
                      fillOpacity={0.15}
                    />
                    <ReferenceLine
                      y={currentRange.analgesiaMax}
                      stroke="#16a34a"
                      strokeDasharray="3 3"
                      label={{ value: t('analgesiaMax'), position: 'insideTopRight', fill: '#166534', fontSize: 10 }}
                    />
                    <ReferenceLine
                      y={currentRange.analgesiaMin}
                      stroke="#16a34a"
                      strokeDasharray="3 3"
                      label={{ value: t('analgesiaMin'), position: 'insideBottomRight', fill: '#166534', fontSize: 10 }}
                    />
                    <ReferenceArea
                      y1={currentRange.respiratoryRisk}
                      y2={9999}
                      fill="#ef4444"
                      fillOpacity={0.05}
                    />
                    <ReferenceLine
                      y={currentRange.respiratoryRisk}
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      label={{ value: `${t('respRisk')} ${currentRange.respiratoryRisk}`, position: 'insideTopLeft', fill: '#dc2626', fontSize: 11, fontWeight: 'bold' }}
                    />
                  </>
                )}

                {/* SAVED TRACES */}
                {savedTraces.map((trace) => (
                  <Line
                    key={trace.id}
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

                {/* CURRENT SIMULATION */}
                <Line
                  data={simData}
                  type="monotone"
                  dataKey="cp"
                  name={`Cp (${drug})`}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  data={simData}
                  type="monotone"
                  dataKey="ce"
                  name={`Ce (${drug})`}
                  stroke="#ec4899"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />

              </LineChart>
            </ResponsiveContainer>

            {
              isClockMode && currentValues && currentSimMinutes >= 0 && currentSimMinutes <= simDuration && (
                <div className="absolute top-2 right-14 bg-white/90 p-2 rounded shadow border border-red-200 text-xs pointer-events-none">
                  <div className="font-bold text-red-600 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    {t('now')} ({currentTime.getHours().toString().padStart(2, '0')}:{currentTime.getMinutes().toString().padStart(2, '0')})
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 mt-1 text-slate-600">
                    <span>Cp:</span> <span className="font-mono font-bold">{currentValues.cp}</span>
                    <span>Ce:</span> <span className="font-mono font-bold">{currentValues.ce}</span>
                  </div>
                </div>
              )
            }
          </div>

          {/* Axis Controls */}
          <div className="flex flex-col sm:flex-row justify-end mt-2 gap-4 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
            {/* Time Axis Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t('timeAxis')}</span>
              <label className="flex items-center gap-1 text-xs cursor-pointer select-none bg-slate-200 px-2 py-1 rounded hover:bg-slate-300 transition-colors mr-2">
                <Clock className="w-3 h-3 text-slate-600" />
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
                <span className="font-semibold text-slate-600">{t('clockMode')}</span>
              </label>

              {
                isClockMode && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="text-xs border border-slate-300 rounded p-1 mr-2"
                  />
                )
              }


              <div className="flex bg-slate-200 rounded-lg p-0.5 gap-0.5">
                {[360, 720, 1440].map((scale) => (
                  <button
                    key={scale}
                    onClick={() => handleScaleChange(scale)}
                    className={`text-[10px] px-2 py-1 rounded ${maxTimeScale === scale ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-300'}`}
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

              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="2880"
                  value={simDuration}
                  onChange={(e) => setSimDuration(Number(e.target.value))}
                  className="w-16 text-right text-xs border border-slate-300 rounded p-1 pr-1 font-mono focus:ring-1 focus:ring-blue-400 outline-none"
                />
                <span className="text-[10px] text-slate-400 absolute right-8 top-1.5 pointer-events-none"></span>
              </div>
              <span className="text-xs text-slate-500">min</span>
            </div>

            <div className="h-4 w-px bg-slate-300 hidden sm:block"></div>

            {/* Y-Axis Control */}
            <div className="flex items-center gap-2">
              <ZoomIn className="w-3 h-3 text-slate-500" />
              <label className="flex items-center gap-1 text-xs cursor-pointer select-none mr-2">
                <input
                  type="checkbox"
                  checked={isAutoY}
                  onChange={(e) => setIsAutoY(e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <span>{t('autoY')}</span>
              </label>
              <input
                type="range" min="1" max="150" step="1"
                value={Math.sqrt(yAxisMax) * 10}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const newMax = (val / 10) ** 2;
                  setYAxisMax(Math.round(newMax * 10) / 10);
                  setIsAutoY(false);
                }}
                disabled={isAutoY && false}
                className={`w-24 md:w-32 accent-pink-500 ${isAutoY ? 'opacity-50' : 'opacity-100'}`}
              />
              <span className="text-xs font-mono w-16 text-right">
                {isAutoY ? t('autoCe') : `${yAxisMax} ng/ml`}
              </span>
            </div>
          </div >

          {
            savedTraces.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {savedTraces.map(t => (
                  <div key={t.id} className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-full text-xs border border-slate-200">
                    <div className="w-2 h-2 rounded-full" style={{ background: t.color }}></div>
                    <span className="font-medium">{t.name}</span>
                    <button onClick={() => removeTrace(t.id)} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )
          }
        </div >

        {/* --- CONTROLS SECTION --- */}
        < div className="grid grid-cols-1 lg:grid-cols-12 gap-4" >

          {/* Left Column: Patient & Model (4 cols) */}
          < div className="lg:col-span-4 space-y-4" >
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-3 text-emerald-600 border-b pb-2">
                <Settings className="h-4 w-4" />
                <h3 className="font-bold text-sm">{t('drugModelSelection')}</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-slate-500 text-xs block mb-1">{t('drug')}</label>
                  <select value={drug} onChange={e => setDrug(e.target.value)} className="w-full border rounded p-2 font-medium bg-emerald-50 text-emerald-900 border-emerald-200">
                    <option value="Fentanyl">Fentanyl (mcg)</option>
                    <option value="Remifentanil">Remifentanil (mcg)</option>
                    <option value="Morphine">Morphine (mg)</option>
                    <option value="Hydromorphone">Hydromorphone (mg)</option>
                    <option value="Hydromorphone">Hydromorphone (mg)</option>
                    <option value="Methadone">Methadone (mg)</option>
                    <option value="Sufentanil">Sufentanil (mcg)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 text-xs block mb-1">{t('pkModel')}</label>
                  <select value={model} onChange={e => setModel(e.target.value)} className="w-full border rounded p-2">
                    {drug === 'Fentanyl' && <>
                      <option>Bae (2020) Adult</option>
                      <option>Shafer (Adult)</option>
                      <option>Ginsberg (Pediatric)</option>
                      <option>Scott (Peds/Adult)</option>
                    </>}
                    {drug === 'Remifentanil' && <>
                      <option>Minto (Adult)</option>
                      <option>Rigby-Jones (Pediatric)</option>
                    </>}
                    {drug === 'Morphine' && <>
                      <option>Maitre (Adult)</option>
                      <option>McFarlan (Pediatric)</option>
                    </>}
                    {drug === 'Hydromorphone' && <>
                      <option>Jeleazcov (2014) Adult</option>
                      <option>Balyan (2020) Pediatric</option>
                      <option>Standard (Adult)</option>
                      <option>Pediatric (Scaled)</option>
                    </>}
                    {drug === 'Methadone' && <>
                      <option>Standard (Adult)</option>
                    </>}
                    {drug === 'Sufentanil' && <>
                      <option>Gepts (1995) Adult</option>
                      <option>Bartkowska-Sniatkowska (2016) PICU</option>
                    </>}
                  </select>
                </div>

                {/* Model Params Display */}
                {parameters && (
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 font-mono mt-2 bg-slate-50 p-1 rounded">
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
                  <div className="mt-2 flex items-start gap-1 text-[10px] text-slate-500 bg-yellow-50 p-1.5 rounded">
                    <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{t('morphineRef')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-3 border-b pb-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <User className="h-4 w-4" />
                  <h3 className="font-bold text-sm">{t('patientSettings')}</h3>
                </div>
                {/* Auto-fill Toggle */}
                <label className="flex items-center gap-1 text-[10px] text-blue-600 cursor-pointer bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition">
                  <Wand2 className="w-3 h-3" />
                  <input
                    type="checkbox"
                    checked={autoFillStats}
                    onChange={(e) => setAutoFillStats(e.target.checked)}
                    className="accent-blue-600 w-3 h-3"
                  />
                  <span>{t('autoAdjust')}</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Age Field (Always active in UI generally, though functionally Minto uses it) */}
                <div>
                  <label className={`text-xs flex justify-between ${getLabelStyle('age')}`}>
                    <span>{t('age')}</span>
                  </label>
                  <input type="number" min="0" value={patient.age}
                    onChange={e => setPatient({ ...patient, age: Math.max(0, Number(e.target.value)) })}
                    className={`w-full border rounded p-1.5 ${getFieldStyle('age')}`}
                  />
                </div>

                {/* Gender Field */}
                <div>
                  <label className={`text-xs flex justify-between ${getLabelStyle('gender')}`}>
                    <span>{t('gender')}</span>
                  </label>
                  <select value={patient.gender}
                    onChange={e => setPatient({ ...patient, gender: e.target.value })}
                    className={`w-full border rounded p-1.5 ${getFieldStyle('gender')}`}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                {/* Weight Field */}
                <div>
                  <label className={`text-xs flex justify-between ${getLabelStyle('weight')}`}>
                    <span>{t('weight')}</span>
                    {autoFillStats && <span className="text-[9px] opacity-50">Auto</span>}
                  </label>
                  <input type="number" min="0" value={patient.weight}
                    onChange={e => setPatient({ ...patient, weight: Math.max(0, Number(e.target.value)) })}
                    className={`w-full border rounded p-1.5 ${getFieldStyle('weight')}`}
                  />
                </div>

                {/* Height Field */}
                <div>
                  <label className={`text-xs flex justify-between ${getLabelStyle('height')}`}>
                    <span>{t('height')}</span>
                    {autoFillStats && <span className="text-[9px] opacity-50">Auto</span>}
                  </label>
                  <input type="number" min="0" value={patient.height}
                    onChange={e => setPatient({ ...patient, height: Math.max(0, Number(e.target.value)) })}
                    className={`w-full border rounded p-1.5 ${getFieldStyle('height')}`}
                  />
                </div>
              </div>

              <div className="mt-2 flex items-start gap-1 text-[10px] text-slate-400">
                <Info className="w-3 h-3 mt-0.5" />
                <span>{t('modelParamsNote')}</span>
              </div>
            </div>
          </div >

          {/* Right Column: Dosing & History (8 cols) */}
          < div className="lg:col-span-8 space-y-4" >
            {/* Dosing Inputs */}
            < div className="grid grid-cols-1 md:grid-cols-2 gap-4" >
              <div className={`p-4 rounded-xl shadow-sm border transition-colors ${editingId === 'bolus' ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3 text-purple-600">
                  <Syringe className="h-4 w-4" />
                  <h3 className="font-bold text-sm">
                    {editingId === 'bolus' ? t('bolusEditing') : t('bolusDose')}
                  </h3>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase text-slate-400 font-bold">{t('dose')} ({getDoseUnit()})</label>
                    <input type="number" min="0" value={bolusAmount} onChange={e => setBolusAmount(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 text-lg font-bold text-center text-purple-700" />
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] uppercase text-slate-400 font-bold">{t('time')}</label>
                    {isClockMode ? (
                      <input
                        type="time"
                        value={minutesToTime(bolusTime, startTime)}
                        onChange={e => setBolusTime(timeToMinutes(e.target.value, startTime))}
                        className="w-full border rounded p-2 text-center text-sm"
                      />
                    ) : (
                      <input type="number" min="0" value={bolusTime} onChange={e => setBolusTime(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 text-center" />
                    )}
                  </div>
                  <button onClick={addBolus} className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg shadow active:scale-95 transition-transform">
                    {editingId === 'bolus' ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className={`p-4 rounded-xl shadow-sm border transition-colors ${editingId === 'infusion' ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3 text-orange-600">
                  <Clock className="h-4 w-4" />
                  <h3 className="font-bold text-sm">
                    {editingId === 'infusion' ? t('infusionEditing') : t('infusion')}
                  </h3>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase text-slate-400 font-bold flex justify-between">
                      <span>{t('rate')}</span>
                      <select
                        value={infusionUnit}
                        onChange={e => setInfusionUnit(e.target.value)}
                        className="text-[9px] border-none bg-transparent p-0 text-right pr-4 font-mono text-slate-500 cursor-pointer focus:ring-0 outline-none"
                        style={{ textAlignLast: 'right' }}
                      >
                        {DRUG_UNITS[drug]?.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </label>
                    <input type="number" min="0" value={infusionRate} onChange={e => setInfusionRate(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 text-lg font-bold text-center text-orange-700" />
                  </div>
                  <div className="w-16">
                    <label className="text-[10px] uppercase text-slate-400 font-bold">{t('start')}</label>
                    {isClockMode ? (
                      <input
                        type="time"
                        value={minutesToTime(infusionStartTime, startTime)}
                        onChange={e => setInfusionStartTime(timeToMinutes(e.target.value, startTime))}
                        className="w-full border rounded p-2 text-center text-sm"
                      />
                    ) : (
                      <input type="number" min="0" value={infusionStartTime} onChange={e => setInfusionStartTime(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 text-center" />
                    )}
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] uppercase text-slate-400 font-bold flex flex-col">
                      <span>{t('duration')}</span>
                      <label className="flex items-center gap-0.5 cursor-pointer">
                        <input type="checkbox" checked={isInfiniteDuration} onChange={e => setIsInfiniteDuration(e.target.checked)} className="accent-orange-600 w-3 h-3" />
                        <span className="text-[9px] normal-case whitespace-nowrap text-slate-600">{t('indefinite')}</span>
                      </label>
                    </label>
                    {isInfiniteDuration ? (
                      <div className="w-full border rounded p-2 text-center text-slate-400 bg-slate-50 text-xl flex items-center justify-center h-[38px]">∞</div>
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
                          className="w-full border rounded p-2 text-center text-sm"
                        />
                      ) : (
                        <input type="number" min="0" value={infusionDuration} onChange={e => setInfusionDuration(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 text-center" />
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
            < div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" >
              <div className="bg-slate-50 p-2 px-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-600">{t('currentSchedule')}</h3>
                <button onClick={() => setEvents([])} className="text-xs text-red-500 hover:underline">{t('clearAll')}</button>
              </div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {events.length === 0 && <div className="p-4 text-center text-slate-400 text-xs">{t('noHistory')}</div>}
                {events.sort((a, b) => a.time - b.time).map(evt => (
                  <div key={evt.id} className="p-2 px-4 flex justify-between items-center text-sm hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      {evt.type === 'bolus' ? <Syringe className="w-4 h-4 text-purple-500" /> : <Activity className="w-4 h-4 text-orange-500" />}
                      <span className="font-mono text-slate-500 w-12 text-right">{evt.time} min</span>
                      <span className="font-medium text-slate-700">
                        {evt.type === 'bolus' ? `${t('bolusLabel')}: ${evt.amount} ${getDoseUnit()}` :
                          `${t('infusionLabel')}: ${evt.originalRate || evt.rate} ${evt.originalUnit || (getDoseUnit() + '/hr')} (${evt.duration}min)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => editEvent(evt)} title={t('editTooltip')} className="text-slate-300 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setEvents(events.filter(e => e.id !== evt.id))} title={t('deleteTooltip')} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div >

            {/* Saved Scenarios List */}
            {savedScenarios.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-indigo-50 p-2 px-4 border-b border-indigo-100 flex justify-between items-center text-indigo-800">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    {t('savedCases')}
                  </h3>
                  <span className="text-xs">{savedScenarios.length} items</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {savedScenarios.map(s => (
                    <div key={s.id} className="p-2 px-4 flex justify-between items-center text-sm hover:bg-slate-50 group">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{s.name}</span>
                        <span className="text-xs text-slate-400">
                          {s.data.events.length} events • {s.data.model}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => loadScenario(s)}
                          className="flex items-center gap-1 bg-white border border-indigo-200 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-50 text-xs"
                        >
                          <Download className="w-3 h-3" />
                          {t('load')}
                        </button>
                        <button
                          onClick={() => deleteScenario(s.id)}
                          className="text-slate-300 hover:text-red-500 p-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div >
        </div >
      </main >
    </div >
  );
};

export default App;
