// Drug data, PK parameters, and unit-conversion helpers.
// Pure data + pure functions — no React, no DOM, safe to import anywhere (incl. tests).

// Therapeutic concentration windows per drug (ng/mL for mcg drugs, ng/mL for mg drugs too — display-side decides scaling).
// analgesiaMin / analgesiaMax are the green band on the chart; respiratoryRisk is the red band & burden-index denominator.
export const THERAPEUTIC_RANGES = {
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

export const DRUG_UNITS = {
  'Fentanyl': ['mcg/kg/hr', 'mcg/hr'],
  'Remifentanil': ['mcg/kg/min', 'mcg/hr', 'mcg/min'],
  'Morphine': ['mg/kg/hr', 'mg/hr', 'mcg/kg/min'],
  'Hydromorphone': ['mg/kg/hr', 'mg/hr', 'mcg/kg/min'],
  'Methadone': ['mg/hr'],
  'Sufentanil': ['mcg/kg/hr', 'mcg/hr']
};

export const CLINICAL_DEFAULTS = {
  'Fentanyl': { bolus: 2.0, rate: 1.5, duration: 60, unit: 'mcg' }, // Bolus: 2mcg/kg, Rate: 1.5 mcg/kg/hr
  'Remifentanil': { bolus: 1.0, rate: 0.25, duration: 60, unit: 'mcg' }, // Bolus: 1mcg/kg, Rate: 0.25 mcg/kg/min
  'Morphine': { bolus: 0.1, rate: 0.03, duration: 120, unit: 'mg' }, // Bolus: 0.1 mg/kg, Rate: 0.03 mg/kg/hr
  'Hydromorphone': { bolus: 0.02, rate: 0.005, duration: 120, unit: 'mg' }, // Bolus: 0.02 mg/kg, Rate: 0.005 mg/kg/hr
  'Methadone': { bolus: 0.1, rate: 0, duration: 60, unit: 'mg' }, // Bolus: 0.1 mg/kg
  'Sufentanil': { bolus: 0.2, rate: 0.3, duration: 60, unit: 'mcg' } // Bolus: 0.2 mcg/kg, Rate: 0.3 mcg/kg/hr
};

export const AVAILABLE_MODELS = {
  'Fentanyl': ['Bae (2020) Adult', 'Shafer (Adult)', 'Ginsberg (Pediatric)', 'Scott (Peds/Adult)'],
  'Remifentanil': ['Minto (Adult)', 'Rigby-Jones (Pediatric)'],
  'Morphine': ['Mazoit (2007) Adult', 'Bouwmeester (2004) Pediatric', 'Anand (2008) Neonate'],
  'Hydromorphone': ['Jeleazcov (2014) Adult', 'Balyan (2020) Pediatric', 'Standard (Adult)', 'Pediatric (Scaled)'],
  'Methadone': ['Standard (Adult)'],
  'Sufentanil': ['Gepts (1995) Adult', 'Bartkowska-Sniatkowska (2016) PICU']
};

// Short labels for chart event markers and QuickEntry chips
export const DRUG_SHORT_NAMES = {
  'Fentanyl': 'Fent',
  'Remifentanil': 'Remi',
  'Morphine': 'Mor',
  'Hydromorphone': 'HM',
  'Methadone': 'Met',
  'Sufentanil': 'Suf'
};

// Per-drug colour pair (Ce solid + Cp lighter) for chart lines and event markers.
// Selected for WCAG AA contrast in both light and dark themes — used by Phase 5-C multi-drug rendering.
export const DRUG_COLORS = {
  Fentanyl:      { ce: '#2563eb', cp: '#93c5fd' }, // blue
  Remifentanil:  { ce: '#0891b2', cp: '#67e8f9' }, // cyan
  Sufentanil:    { ce: '#7c3aed', cp: '#c4b5fd' }, // violet
  Morphine:      { ce: '#dc2626', cp: '#fca5a5' }, // red
  Hydromorphone: { ce: '#ea580c', cp: '#fdba74' }, // orange
  Methadone:     { ce: '#16a34a', cp: '#86efac' }, // green
};

export const DRUG_LIST = Object.keys(DRUG_UNITS);

export const getDoseUnitForDrug = (drug) => CLINICAL_DEFAULTS[drug]?.unit || 'mcg';

const MG_DRUGS = ['Morphine', 'Hydromorphone', 'Methadone'];

export const calculateLBM = (weight, height, gender) => {
  if (!height || !weight) return weight;
  if (gender === 'male') {
    return (1.1 * weight) - (128 * ((weight / height) ** 2));
  }
  return (1.07 * weight) - (148 * ((weight / height) ** 2));
};

// 3-compartment + effect-site PK parameters keyed by (drug, model). Falls back to a benign
// V1=1 stub when weight is invalid — caller must check and avoid simulating in that case
// (Phase 5-D's QuickEntry surfaces a red banner; Phase 5-C will gate the simulation memo).
export const getPKParameters = (drug, model, patient) => {
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
    if (model === 'Bouwmeester (2004) Pediatric') {
      // Bouwmeester et al. BJA 2004; 92: 208-17
      // 1-compartment model
      // V = 136 * (W/70)
      // Cl = 71 * (W/70)^0.75 * (AgeDays / (AgeDays + 88.3))
      // TM50 = 88.3 days
      const ageDays = age * 365;
      const wRatio = weight / 70;
      const matFactor = ageDays / (ageDays + 88.3);

      params.V1 = 136.0 * wRatio;
      params.V2 = 0; // 1-comp
      params.V3 = 0;
      params.Cl = (71.0 / 60) * (wRatio ** 0.75) * matFactor;
      params.Q2 = 0;
      params.Q3 = 0;
      params.ke0 = 0.01; // Estimated

    } else if (model === 'Anand (2008) Neonate') {
      // Anand KJS et al. BJA 2008; 101: 680-9
      // NEOPAIN secondary results
      // CL = CLstd * (W/70)^0.75 * (PMA^3.92 / (TM50^3.92 + PMA^3.92))
      // CLstd = 84.2 L/h, TM50 = 54.2 weeks, Hill = 3.92
      // V = 190 * (W/70)

      // Calculate PMA in weeks. Assumes term birth (40w) + age(years)*52
      const pma = 40 + (age * 52.14);
      const wRatio = weight / 70;
      const hill = 3.92;
      const tm50 = 54.2;

      const matFactor = (pma ** hill) / ((tm50 ** hill) + (pma ** hill));

      params.V1 = 190.0 * wRatio;
      params.V2 = 0;
      params.V3 = 0;
      params.Cl = (84.2 / 60) * (wRatio ** 0.75) * matFactor;
      params.Q2 = 0;
      params.Q3 = 0;
      params.ke0 = 0.005; // Slower equilibration in neonates

    } else if (model === 'Mazoit (2007) Adult') {
      // Mazoit JX et al. Anesth Analg 2007; 105: 70-8
      // Paper focused on metabolites, M stays predictable/standard
      // Using standard 3-comp values consistent with adult morphine PK
      // VD ~ 3-4 L/kg, Cl ~ 15-20 ml/min/kg
      const wRatio = weight / 70;

      params.V1 = 10.0 * wRatio;
      params.V2 = 23.0 * wRatio;
      params.V3 = 138.0 * wRatio;
      params.Cl = 1.4 * wRatio; // ~ 84 L/h / 60
      params.Q2 = 0.6 * wRatio; // ~ 36 L/h / 60
      params.Q3 = 0.2 * wRatio; // ~ 12 L/h / 60
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

// --- Unit conversion ---
// Standard unit: mcg/hr for mcg drugs, mg/hr for mg drugs.

export const convertToStandardUnit = (rate, unit, weight, drug) => {
  const isMgDrug = MG_DRUGS.includes(drug);
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
  return isMgDrug ? valInMcgHr / 1000 : valInMcgHr;
};

export const convertFromStandardUnit = (standardRate, targetUnit, weight, drug) => {
  const isMgDrug = MG_DRUGS.includes(drug);
  const valInMcgHr = isMgDrug ? standardRate * 1000 : standardRate;
  switch (targetUnit) {
    case 'mcg/hr': return valInMcgHr;
    case 'mg/hr': return valInMcgHr / 1000;
    case 'mcg/kg/min': return valInMcgHr / (weight * 60);
    case 'mcg/min': return valInMcgHr / 60;
    case 'mcg/kg/hr': return valInMcgHr / weight;
    case 'mg/kg/hr': return valInMcgHr / (weight * 1000);
    default: return standardRate;
  }
};
