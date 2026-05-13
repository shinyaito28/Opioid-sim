// Drug data, PK parameters, and unit-conversion helpers.
// Pure data + pure functions — no React, no DOM, safe to import anywhere (incl. tests).

// Therapeutic concentration windows per drug (ng/mL for mcg drugs, ng/mL for mg drugs too — display-side decides scaling).
// analgesiaMin / analgesiaMax are the green band on the chart; respiratoryRisk (C50) is the red band & burden-index denominator.
// Citation-verified (Phase 5-E) on 2026-04-27 against PubMed.
export const THERAPEUTIC_RANGES = {
  'Fentanyl': {
    // Analgesia 0.5-2.5 ng/mL: Bae J et al. Br J Anaesth 2020;125:976-985 (PMID:32861508).
    // Resp C50 2.3 ng/mL: van Lemmen M et al. Anesthesiology 2025;143:1171-1183 (PMID:40773676)
    //   — physiologic CO2-kinetics model gave 2.3±0.5 ng/mL; simpler model gave 7.5±1.3 ng/mL.
    analgesiaMin: 0.5,
    analgesiaMax: 2.5,
    respiratoryRisk: 2.3,
    label: 'Analgesia (0.5-2.5) / Resp C50: 2.3'
  },
  'Remifentanil': {
    // Phase 5-K-1 update: respiratoryRisk Ce50 verified from Babenco HD et al. Anesthesiology
    // 2000;92:393-398 (PMID:10691225) — EC50 = 1.12 ng/mL for ventilatory depression in 8 healthy
    // volunteers. Analgesic range 1-8 ng/mL spans postop PCA threshold up through TIVA surgical
    // depths (Ce values in full text of Egan 1996, PMID:8638836; abstract-level numbers sparse).
    // Old values (3.0-8.0 / 2.5) were textbook consensus. See therapeuticReferences.js.
    analgesiaMin: 1.0,
    analgesiaMax: 8.0,
    respiratoryRisk: 1.1,
    label: 'Analgesia (1.0-8.0) / Resp C50: 1.1 (Babenco 2000)'
  },
  'Morphine': {
    // Phase 5-K-1 update: analgesia 20-80 ng/mL from Owen 1985 PCA study (PMID:3156020) —
    // patients defined MEAC of 20-40 ng/mL, max self-administered 82 ng/mL. Respiratory C50
    // ~9 ng/mL from Dahan 2004 (PMID:15505457) integrated NONMEM analysis: potency parameter
    // 32 nM ≈ 9 ng/mL morphine free base, supported by Romberg 2003 (PMID:14508308).
    // Note: Dahan 2004 found analgesia and respiratory potency are essentially equal —
    // therapeutic dosing routinely sits well above respiratory C50.
    analgesiaMin: 20,
    analgesiaMax: 80,
    respiratoryRisk: 10,
    label: 'Analgesia (20-80) / Resp C50: ~9-10 (Dahan 2004)'
  },
  'Hydromorphone': {
    // Phase 5-K-5: analgesiaMin 2.0 → 4.0 ng/mL, aligned with Olofsen 2026 BJA
    // (PMID:41656122) direct analgesic potency measurement in the SAME 51 healthy
    // volunteer cohort that produced respC50,Phys = 3.4 ng/mL. Olofsen Table 2:
    // limit-temperature C1D = 4.4 ng/mL (IQR 3.4-5.5), VAS T50 C1D = 4.0 ng/mL
    // (IQR 3.1-6.0). The previous 2.0 came from Coda 1997 morphine:HM = 5:1 PCA
    // ratio extrapolation, which is inconsistent with Olofsen's direct data.
    // Net effect: analgesiaMin (4.0) now sits ABOVE respC50 (3.4), correctly
    // reflecting Olofsen's finding that HM analgesic and respiratory potencies
    // are in essentially the same Ce range — therapeutic window is extremely
    // narrow (clinically meaningful respiratory depression starts before
    // adequate analgesia is reached on average).
    // Phase 5-K-3: respiratoryRisk 1.0 → 3.4 ng/mL from Olofsen C50,Phys (direct,
    // 50% depression of ventilatory controller output via NONMEM).
    analgesiaMin: 4.0,
    analgesiaMax: 8.0,
    respiratoryRisk: 3.4,
    label: 'Analgesia (4.0-8.0) / Resp C50: 3.4 (Olofsen 2026)'
  },
  'Methadone': {
    // Phase 5-K-1 update: analgesia Css50 ~290-359 ng/mL from Inturrisi 1987/1990
    // (PMID:3829576, PMID:2188771) in cancer pain patients. Range 100-400 ng/mL covers
    // typical chronic-pain titration. Respiratory C50 is INFERRED from sedation Css50
    // (336 ng/mL ≈ analgesia Css50 in same paper) — no primary respiratory C50 paper with
    // abstract-level numbers located. Provisional flag set in therapeuticReferences.js.
    // Methadone individual variability is huge (Inturrisi range 40-1130 ng/mL) and QT
    // prolongation is a separate non-Ce concern.
    analgesiaMin: 100,
    analgesiaMax: 400,
    respiratoryRisk: 400,
    label: 'Analgesia (100-400) / Resp Ce ~400 (Inturrisi 1990, inferred)'
  },
  'Sufentanil': {
    // Phase 5-K-1 update: MEAC 0.03 ng/mL from Lehmann 1991 (PMID:1674829) — explicitly
    // stated minimum threshold for analgesia in postop PCA. Upper PCA range 0.5 ng/mL.
    // Respiratory Ce50 ~0.5 ng/mL from Bailey 1990 (PMID:2136976) — abstract describes
    // qualitative comparison vs fentanyl, numeric Ce50 in full text only.
    analgesiaMin: 0.03,
    analgesiaMax: 0.5,
    respiratoryRisk: 0.5,
    label: 'Analgesia (0.03-0.5) / Resp C50 ~0.5 (Lehmann 1991, Bailey 1990)'
  },
  'Propofol': {
    // Sedative — therapeutic effect-site Ce typically 1.5-4.5 mcg/mL for sedation
    // and 3-5 mcg/mL for GA maintenance (BIS 40-60). Sources for the band:
    //   Schnider TW et al. Anesthesiology 1999;90:1502-16  — Ce50 BIS ≈ 2.5 mcg/mL
    //   Vuyk J  et al. Br J Anaesth 1995;75:223-9          — BIS 50 Ce ~3.4 mcg/mL
    //   Eleveld DJ et al. Br J Anaesth 2018;120:942-59     — general-purpose PK/PD
    //                                                         model used in this app
    //                                                         (TIVA maintenance Ce
    //                                                         2.5-4.5 mcg/mL typical)
    // Phase 5-M-1: bisTarget values are now stored in **ng/mL** (matching the
    // internal simulation unit). The chart display layer divides by chartDisplay
    // .divisor (1000 for Propofol) at render time to show "3.00-5.00 mcg/mL".
    // The previous value pair {3.0, 5.0} was implicitly in mcg/mL and collapsed
    // the BIS band to y=3-5 ng/mL on the chart, far below the actual Cp range.
    bisTarget: { min: 3000, max: 5000 }, // ng/mL = 3-5 mcg/mL Ce (BIS 40-60, GA maintenance)
    label: 'BIS 40-60 @ Ce 3-5 mcg/mL (Schnider/Eleveld)'
  },
  'Ketamine': {
    // Sedative — S-ketamine PK only (Noppers I et al. Anesthesiology 2011;114:1435-45,
    // PMC3560924 open access). Racemic ketamine PK is intentionally NOT implemented; the
    // S-ketamine plasma concentrations shown here should not be interpreted as total
    // racemic ketamine. ke0 is intentionally not implemented because PD endpoints
    // (analgesia, sedation, dissociation, EEG, hemodynamics) have endpoint-specific
    // concentration-effect relationships and no single ke0 captures all clinical effects
    // (Sigtermans 2009 Pain CRPS infusion, Olofsen 2012 Anesthesiology, Noppers 2011 use
    // sigmoid Emax linked directly to plasma — no effect-site delay assumed).
    //
    // Single experimental reference line at C50 = 375 ng/mL — heat-pain endpoint used in
    // Noppers 2011 simulations (Sigtermans/Noppers anchor). Drawn as a labelled horizontal
    // line (not a band) to communicate that this is an experimental analgesia anchor, not
    // a sedation/anesthesia threshold.
    experimentalReferenceLine: {
      value: 375,
      labelKey: 'ketamineHeatPainRef'
    },
    disabledCe: { reasonKey: 'sedationCeUnavailableReason' },
    contextWarningKey: 'ketamineContextWarning',
    label: 'S-ketamine Cp only — Noppers 2011 (heat-pain ref 375 ng/mL)'
  },
  'Remimazolam': {
    // Sedative — 3-comp + effect-site model from Eleveld DJ et al. Br J Anaesth 2025
    // (PMC12597572, open access). The Eleveld 2025 model is a pooled analysis of 20
    // studies including Schüttler J et al. Anesthesiology 2020;132:636-651 (PMID:31972655),
    // so it represents the most comprehensive published Remimazolam PKPD parameters.
    // CL/Vss values agree with Schüttler 2020 within reported variance (CL 1.12 vs 1.15
    // L/min) so the simpler Eleveld model is used as primary citation.
    //
    // PD anchors verified from Eleveld 2025 PMC text (2026-04-29):
    //   Ce50 MOAA/S ≤1: 0.182 mcg/mL  → light/moderate sedation transition
    //   Ce50 BIS:        0.982 mcg/mL → general anesthesia depth
    // bisTarget below represents the typical Ce range during GA maintenance with
    // concomitant opioid (TIVA) — between MOAA/S and BIS Ce50.
    // Phase 5-M-1: bisTarget moved to ng/mL units (was {0.4, 0.8} mcg/mL).
    // 400-800 ng/mL = 0.4-0.8 mcg/mL Ce, sitting between Eleveld 2025 MOAA/S Ce50
    // (0.182 mcg/mL = 182 ng/mL) and BIS Ce50 (0.982 mcg/mL = 982 ng/mL) — i.e.
    // typical GA maintenance with concomitant opioid (TIVA).
    bisTarget: { min: 400, max: 800 }, // ng/mL = 0.4-0.8 mcg/mL Ce (GA maintenance)
    label: 'GA maintenance Ce 0.4-0.8 mcg/mL (Eleveld 2025)'
  },
  'Dexmedetomidine': {
    // Sedative — Hannivoort 2015 PK is plasma-only (no PD/effect-site model). The SedationChart
    // therefore displays Cp by default and overlays Cp-based clinical sedation bands sourced from
    // the Weerink 2017 review (PMC5511603, open access):
    //   - 0.2-0.3 ng/mL: significant / rousable sedation
    //   - >1.9 ng/mL: possible unarousable deep sedation
    // ke0 is intentionally not included in the default model so the chart never implies a
    // pharmacodynamic precision the source paper does not support.
    sedationBands: [
      { min: 0.2, max: 0.3, kind: 'light' },
      { min: 1.9, max: 10,  kind: 'deep'  } // 10 ng/mL clamp — clinical Cp rarely exceeds this
    ],
    // Advanced/research-only ke0 from Colin et al. BJA 2017;119:200-210 (PMID:28854538) — MOAA/S
    // sedation endpoint in healthy volunteers. Surfaces in SedationChart only when the user opts
    // into the explicit Advanced toggle; the Ce line is then labelled as exploratory PKPD, not a
    // clinical dosing target.
    advancedKe0: 0.0428, // /min  →  t1/2,ke0 ≈ 16.2 min
    advancedKe0Source: 'Colin 2017 MOAA/S endpoint',
    contextWarningKey: 'dexContextWarning',
    label: 'Sedation 0.2-0.3 (light) / >1.9 (deep) ng/mL — Weerink 2017'
  }
};

export const DRUG_UNITS = {
  'Fentanyl': ['mcg/kg/hr', 'mcg/hr'],
  'Remifentanil': ['mcg/kg/min', 'mcg/hr', 'mcg/min'],
  'Morphine': ['mg/kg/hr', 'mg/hr', 'mcg/kg/min'],
  'Hydromorphone': ['mg/kg/hr', 'mg/hr', 'mcg/kg/min'],
  'Methadone': ['mg/hr'],
  'Sufentanil': ['mcg/kg/hr', 'mcg/hr'],
  'Propofol': ['mcg/kg/min', 'mg/kg/hr', 'mg/hr'], // typical TCI / clinical infusion units
  'Remimazolam': ['mg/kg/hr', 'mg/hr', 'mcg/kg/min'], // GA maintenance 1-2 mg/kg/hr or 17-33 mcg/kg/min
  'Ketamine': ['mg/kg/hr', 'mg/hr', 'mcg/kg/min'], // analgesic 0.1-0.5 mg/kg/hr; higher for sedation
  'Dexmedetomidine': ['mcg/kg/hr', 'mcg/hr', 'mcg/kg/min'] // ICU sedation maintenance
};

export const CLINICAL_DEFAULTS = {
  'Fentanyl': { bolus: 2.0, rate: 1.5, duration: 60, unit: 'mcg' }, // Bolus: 2mcg/kg, Rate: 1.5 mcg/kg/hr
  'Remifentanil': { bolus: 1.0, rate: 0.25, duration: 60, unit: 'mcg' }, // Bolus: 1mcg/kg, Rate: 0.25 mcg/kg/min
  'Morphine': { bolus: 0.1, rate: 0.03, duration: 120, unit: 'mg' }, // Bolus: 0.1 mg/kg, Rate: 0.03 mg/kg/hr
  'Hydromorphone': { bolus: 0.02, rate: 0.005, duration: 120, unit: 'mg' }, // Bolus: 0.02 mg/kg, Rate: 0.005 mg/kg/hr
  'Methadone': { bolus: 0.1, rate: 0, duration: 60, unit: 'mg' }, // Bolus: 0.1 mg/kg
  'Sufentanil': { bolus: 0.2, rate: 0.3, duration: 60, unit: 'mcg' }, // Bolus: 0.2 mcg/kg, Rate: 0.3 mcg/kg/hr
  'Propofol': { bolus: 1.5, rate: 100, duration: 60, unit: 'mg' }, // Bolus: 1.5 mg/kg (induction), Rate: 100 mcg/kg/min (GA maintenance)
  'Remimazolam': { bolus: 0.1, rate: 1.0, duration: 60, unit: 'mg' }, // Bolus: 0.1 mg/kg (sedation/induction proxy), Rate: 1 mg/kg/hr (GA maintenance)
  'Ketamine': { bolus: 0.5, rate: 0.2, duration: 60, unit: 'mg' }, // Bolus: 0.5 mg/kg sub-anesthetic, Rate: 0.2 mg/kg/hr analgesic infusion
  'Dexmedetomidine': { bolus: 1.0, rate: 0.7, duration: 60, unit: 'mcg' } // Bolus: 1 mcg/kg loading over 10 min, Rate: 0.7 mcg/kg/hr maintenance (ICU range 0.2–1.4)
};

export const AVAILABLE_MODELS = {
  'Fentanyl': ['Bae (2020) Adult', 'Shafer (Adult)', 'Ginsberg (Pediatric)', 'Scott (Peds/Adult)'],
  'Remifentanil': ['Minto (Adult)', 'Rigby-Jones (Pediatric)'],
  'Morphine': ['Mazoit (2007) Adult', 'Bouwmeester (2004) Pediatric', 'Anand (2008) Neonate'],
  'Hydromorphone': ['Jeleazcov (2014) Adult', 'Balyan (2020) Pediatric', 'Standard (Adult)', 'Pediatric (Scaled)'],
  'Methadone': ['Standard (Adult)'],
  'Sufentanil': ['Gepts (1995) Adult', 'Bartkowska-Sniatkowska (2016) PICU'],
  'Propofol': ['Eleveld (2018) General-purpose'],
  'Remimazolam': ['Eleveld (2025) Adult'],
  'Ketamine': ['Noppers (2011) S-ketamine'],
  'Dexmedetomidine': ['Hannivoort (2015) Adult']
};

// Short labels for chart event markers and QuickEntry chips
export const DRUG_SHORT_NAMES = {
  'Fentanyl': 'Fent',
  'Remifentanil': 'Remi',
  'Morphine': 'Mor',
  'Hydromorphone': 'HM',
  'Methadone': 'Met',
  'Sufentanil': 'Suf',
  'Propofol': 'Prop',
  'Remimazolam': 'Rmz',
  'Ketamine': 'Ket',
  'Dexmedetomidine': 'Dex'
};

// Per-drug colour pair (Ce solid + Cp lighter) for chart lines and event markers.
// Selected for WCAG AA contrast in both light and dark themes — used by Phase 5-C multi-drug rendering.
// Phase 5-G-1 added Propofol as teal — picked to be distinguishable from existing 6 opioids.
export const DRUG_COLORS = {
  Fentanyl:      { ce: '#2563eb', cp: '#93c5fd' }, // blue
  Remifentanil:  { ce: '#0891b2', cp: '#67e8f9' }, // cyan
  Sufentanil:    { ce: '#7c3aed', cp: '#c4b5fd' }, // violet
  Morphine:      { ce: '#dc2626', cp: '#fca5a5' }, // red
  Hydromorphone: { ce: '#ea580c', cp: '#fdba74' }, // orange
  Methadone:     { ce: '#16a34a', cp: '#86efac' }, // green
  Propofol:      { ce: '#0d9488', cp: '#5eead4' }, // teal — sedative class
  Remimazolam:   { ce: '#c026d3', cp: '#f0abfc' }, // fuchsia — sedative, distinguishable from teal/indigo/violet
  Ketamine:      { ce: '#e11d48', cp: '#fda4af' }, // rose — sedative, distinguishable from Mor red and other sedatives
  Dexmedetomidine: { ce: '#4f46e5', cp: '#a5b4fc' }, // indigo — sedative class, distinguishable from Propofol teal
};

// Drug class — affects whether Ce contributes to the Combined Opioid Burden Index.
// Only 'opioid' drugs are included in burden; 'sedative' drugs render Cp/Ce but don't contribute.
export const DRUG_CLASS = {
  Fentanyl:      'opioid',
  Remifentanil:  'opioid',
  Morphine:      'opioid',
  Hydromorphone: 'opioid',
  Methadone:     'opioid',
  Sufentanil:    'opioid',
  Propofol:      'sedative',
  Remimazolam:   'sedative',
  Ketamine:      'sedative',
  Dexmedetomidine: 'sedative',
};

// Display unit per drug. The simulation engine emits values in ng/mL internally; the UI divides
// by `divisor` before plotting and tooltip display. Sedatives use mcg/mL because therapeutic
// concentrations are 1000× larger than opioid Ce — sharing a ng/mL axis would make opioid curves
// invisible at the bottom of an auto-scaled chart.
//
// `yDefaultMax` / `yMaxLimit` (sedatives only): SedationChart Y-axis zoom slider.
// `yDefaultMax` is the value used when Auto-Y is toggled off — picked to fit the therapeutic
// band cleanly. `yMaxLimit` is the upper bound the slider can reach. Sqrt mapping is used in
// the slider so PD-focused small values (e.g., 0.1-0.5 ng/mL Ce) get fine resolution.
export const DRUG_DISPLAY = {
  Fentanyl:      { unit: 'ng/mL',  divisor: 1 },
  Remifentanil:  { unit: 'ng/mL',  divisor: 1 },
  Morphine:      { unit: 'ng/mL',  divisor: 1 },
  Hydromorphone: { unit: 'ng/mL',  divisor: 1 },
  Methadone:     { unit: 'ng/mL',  divisor: 1 },
  Sufentanil:    { unit: 'ng/mL',  divisor: 1 },
  Propofol:      { unit: 'mcg/mL', divisor: 1000, yDefaultMax: 10, yMaxLimit: 50 },  // BIS target ~3-5 mcg/mL → 10 fits, slider goes up to 50
  Remimazolam:   { unit: 'mcg/mL', divisor: 1000, yDefaultMax: 2,  yMaxLimit: 5 },   // GA target 0.4-0.8 mcg/mL Ce → 2 fits, peak Cp ~3-5
  Ketamine:      { unit: 'ng/mL',  divisor: 1,    yDefaultMax: 500, yMaxLimit: 3000 }, // heat-pain ref 375 ng/mL; bolus peak ~1-3 mcg/mL
  Dexmedetomidine: { unit: 'ng/mL', divisor: 1, yDefaultMax: 2, yMaxLimit: 20 },     // Sedation bands 0.2-1.9 ng/mL → 2 fits, slider goes up to 20
};

export const DRUG_LIST = Object.keys(DRUG_UNITS);

export const getDoseUnitForDrug = (drug) => CLINICAL_DEFAULTS[drug]?.unit || 'mcg';

// Drugs whose user-facing dose is in mg (not mcg). The simulation engine multiplies bolus
// amounts by 1000 for these so all internal mass quantities are in mcg, giving Cp/Ce in ng/mL.
const MG_DRUGS = ['Morphine', 'Hydromorphone', 'Methadone', 'Propofol', 'Remimazolam', 'Ketamine'];

export const calculateLBM = (weight, height, gender) => {
  if (!height || !weight) return weight;
  if (gender === 'male') {
    return (1.1 * weight) - (128 * ((weight / height) ** 2));
  }
  return (1.07 * weight) - (148 * ((weight / height) ** 2));
};

// --- Eleveld 2018 Propofol PK helpers ---
// All 18 θ values verified by cross-reference between two open-source TCI implementations
// (ysuzuki1978/propofol-tci-simulator JS, clybb7/propPK MATLAB) plus the BJA 2018 abstract.
// PMID:29661412. doi:10.1016/j.bja.2018.01.018.
const ELEVELD_THETA = {
  1:  6.28,    // V1 reference (L) — 70kg/35yr/170cm/male/no opioid/arterial
  2:  25.5,    // V2 reference (L)
  3:  273,     // V3 reference (L)
  4:  1.79,    // CL reference, male (L/min)
  5:  1.75,    // Q2 reference, arterial (L/min)
  6:  1.11,    // Q3 reference (L/min)
  7:  0.191,   // residual error (not used in deterministic calc)
  8:  42.3,    // CL maturation E50 (weeks PMA)
  9:  9.06,    // CL maturation Hill slope
  10: -0.0156, // V2 ageing exponent
  11: -0.00286,// CL effect of concomitant opioids: exp(θ11 × age)
  12: 33.6,    // V1 weight Hill E50 (kg, slope = 1)
  13: -0.0138, // V3 effect of concomitant opioids: exp(θ13 × age)
  14: 68.3,    // Q3 maturation E50 (weeks PMA, slope = 1)
  15: 2.10,    // CL reference, female (L/min)
  16: 1.30,    // Q2 boost when Q3 maturation incomplete: (1 + θ16 × (1 − fQ3mat))
  17: 1.42,    // V1 venous-vs-arterial multiplier (unused in default arterial mode)
  18: 0.68     // Q2 venous-vs-arterial multiplier
};

// Al-Sallami fat-free-mass equation, verbatim from Eleveld 2018's covariate model.
// `gender` is 'male' | 'female'.
const alSallamiFFM = (weight, height, age, gender) => {
  if (!height || !weight) return weight;
  if (age < 2) return weight * 0.82; // pediatric override (Source A's heuristic)
  const bmi = weight / Math.pow(height / 100, 2);
  if (gender === 'male') {
    const t1 = (0.88 * 9270 * weight) / (6680 + 216 * bmi);
    const t2 = (1 - 0.88) / (1 + Math.pow(age / 13.4, -12.7));
    const t3 = 1.11 * weight - 128 * Math.pow(weight / height, 2);
    return t1 + t2 * t3;
  }
  const t1 = (1.11 * 9270 * weight) / (8780 + 244 * bmi);
  const t2 = (1 - 1.11) / (1 + Math.pow(age / 7.1, -1.1));
  const t3 = 1.07 * weight - 148 * Math.pow(weight / height, 2);
  return t1 + t2 * t3;
};

const fSigmoid = (x, e50, gamma) =>
  Math.pow(x, gamma) / (Math.pow(x, gamma) + Math.pow(e50, gamma));
const fAgeing = (rate, age, ageRef = 35) => Math.exp(rate * (age - ageRef));
const fOpiates = (rate, age, opioidCoadmin) => (opioidCoadmin ? Math.exp(rate * age) : 1);

// Compute Eleveld 2018 propofol PK parameters for a given patient.
// `opioidCoadmin` defaults to true (Eleveld's reference condition with concomitant anaesthetic drugs);
// `arterialSampling` defaults to true (TCI standard). Phase 5-G-1 hardcodes both — Phase 5-G-5
// (Bouillon synergy) will derive opioidCoadmin from activeDrugs.
const getEleveldPropofol = (patient, { opioidCoadmin = true, arterialSampling = true } = {}) => {
  const { age, weight, height, gender } = patient;
  const T = ELEVELD_THETA;

  const WGT_REF = 70;
  const PMA_REF_WK = 35 * 52 + 40; // 1860 weeks (term-born 35-year-old)
  const pma = age * 52 + 40;        // post-menstrual age (weeks)

  const ffm = alSallamiFFM(weight, height || 170, age, gender);
  const ffmRef = alSallamiFFM(WGT_REF, 170, 35, 'male'); // ~54.4 kg

  // Volumes
  const fCentralWgt    = fSigmoid(weight,  T[12], 1);
  const fCentralWgtRef = fSigmoid(WGT_REF, T[12], 1);

  let V1 = T[1] * (fCentralWgt / fCentralWgtRef);
  const V2 = T[2] * (weight / WGT_REF) * fAgeing(T[10], age);
  const V3 = T[3] * (ffm / ffmRef) * fOpiates(T[13], age, opioidCoadmin);

  // Clearances
  const fCLmat    = fSigmoid(pma,        T[8], T[9]);
  const fCLmatRef = fSigmoid(PMA_REF_WK, T[8], T[9]);
  const CLbase = gender === 'female' ? T[15] : T[4];

  const Cl = CLbase
    * Math.pow(weight / WGT_REF, 0.75)
    * (fCLmat / fCLmatRef)
    * fOpiates(T[11], age, opioidCoadmin);

  const fQ3mat    = fSigmoid(pma,        T[14], 1);
  const fQ3matRef = fSigmoid(PMA_REF_WK, T[14], 1);

  let Q2 = T[5]
    * Math.pow(V2 / T[2], 0.75)
    * (1 + T[16] * (1 - fQ3mat));

  const Q3 = T[6]
    * Math.pow(V3 / T[3], 0.75)
    * (fQ3mat / fQ3matRef);

  // Venous-sampling correction (verified θ values, but neither reference repo applies them explicitly;
  // formula here follows the paper's text, opt-in only when caller passes arterialSampling: false).
  if (!arterialSampling) {
    V1 *= T[17];
    Q2 *= (1 + T[18] * (1 - fQ3mat));
  }

  // ke0 from Source B's verified line: Oke0 = (weight/70)^-0.25 × 0.146.
  const ke0 = 0.146 * Math.pow(weight / WGT_REF, -0.25);

  return { V1, V2, V3, Cl, Q2, Q3, ke0 };
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
      // Reference: Bae J et al. Br J Anaesth 2020;125:976-985. PMID:32861508.
      // "An allometric pharmacokinetic model and minimum effective analgesic concentration of
      // fentanyl in patients undergoing major abdominal surgery." Adults; allometric scaling on W/70.
      const wRatio = weight / 70;
      params.V1 = 10.1 * (wRatio ** 1.0);
      params.V2 = 26.5 * (wRatio ** 1.0);
      params.V3 = 206.0 * (wRatio ** 1.0);
      params.Cl = 0.704 * (wRatio ** 0.75);
      params.Q2 = 2.38 * (wRatio ** 0.75);
      params.Q3 = 1.49 * (wRatio ** 0.75);
      params.ke0 = 0.147;
    } else if (model === 'Shafer (Adult)') {
      // Reference: Shafer SL et al. Anesthesiology 1990;73:1091-1102. PMID:2248388.
      // "Pharmacokinetics of fentanyl administered by computer-controlled infusion pump." Adult TCI standard.
      params.V1 = 15; params.V2 = 40; params.V3 = 200;
      params.Cl = 0.5; params.Q2 = 1.5; params.Q3 = 1.0;
      params.ke0 = 0.14;
    } else if (model === 'Ginsberg (Pediatric)') {
      // Reference: Ginsberg B et al. Anesthesiology 1996;85:1268-1275. PMID:8968173.
      // "Pharmacokinetic model-driven infusion of fentanyl in children." Pediatric TCI.
      params.V1 = 0.5 * weight; params.V2 = 1.8 * weight; params.V3 = 8.5 * weight;
      params.Cl = 0.022 * weight; params.Q2 = 0.05 * weight; params.Q3 = 0.03 * weight;
      params.ke0 = 0.16;
    } else if (model === 'Scott (Peds/Adult)') {
      // Reference: Scott JC et al. Anesthesiology 1985;62:234-241. PMID:3919613.
      // "EEG quantitation of narcotic effect: the comparative pharmacodynamics of fentanyl and alfentanil."
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
      // Reference: Minto CF et al. Anesthesiology 1997;86:10-23 (Part I; PMID:9009935) and
      // Minto CF, Schnider TW, Shafer SL. Anesthesiology 1997;86:24-33 (Part II; PMID:9009936).
      // Age + LBM covariates; the canonical adult remi PK/PD pair.
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
      // Reference: Rigby-Jones AE et al. Br J Anaesth 2007;99:252-261. PMID:17578905.
      // Pediatric ICU population PK after cardiac surgery.
      params.V1 = 0.7 * weight; params.V2 = 1.0 * weight; params.V3 = 0.7 * weight;
      params.Cl = 0.05 * weight; params.Q2 = 0.04 * weight; params.Q3 = 0.02 * weight;
      params.ke0 = 0.9;
    }
  }
  // --- MORPHINE ---
  else if (drug === 'Morphine') {
    if (model === 'Bouwmeester (2004) Pediatric') {
      // Reference: Bouwmeester NJ et al. Br J Anaesth 2004;92:208-217. PMID:14722170.
      // 1-compartment model. Neonates / infants / young children.
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
      // Reference: Anand KJS et al. Br J Anaesth 2008;101:680-689. PMID:18723857.
      // NEOPAIN secondary analysis. Neonates with maturity factor (postmenstrual age).
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
      // Reference: Mazoit JX, Butscher K, Samii K. Anesth Analg 2007;105:70-78. PMID:17578959.
      // Paper focused on M3G/M6G metabolites; the 3-comp morphine model used here is the
      // canonical adult morphine PK (VD ~3-4 L/kg, Cl ~15-20 ml/min/kg).
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
      // Reference: Jeleazcov C et al. Anesthesiology 2014;120:378-391. PMID:23958818.
      // Cardiac surgery patients; age covariate on Cl reflects elderly clearance reduction.
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
      // Reference: Balyan R et al. Paediatr Anaesth 2020;30:1091-1101. PMID:32702184.
      // "Hydromorphone population pharmacokinetics in pediatric surgical patients." 2-compartment.
      const wRatio = weight / 70;
      params.V1 = 33.0 * (wRatio ** 1.0);
      params.V2 = 146.0 * (wRatio ** 1.0);
      params.V3 = 0;
      params.Cl = 0.748 * (wRatio ** 0.75);
      params.Q2 = 1.57 * (wRatio ** 0.75);
      params.Q3 = 0;
      params.ke0 = 0.03;
    } else if (model === 'Standard (Adult)') {
      // No published source; allometric W-linear scaling from textbook references. KEEP for
      // backward compat with saved scenarios but treat as unsourced. Phase 5-E known-bug task
      // suggested removal — deferred until users have migrated saved scenarios.
      params.V1 = 0.25 * weight; params.V2 = 0.6 * weight; params.V3 = 4.0 * weight;
      params.Cl = 0.02 * weight; params.Q2 = 0.02 * weight; params.Q3 = 0.01 * weight;
      params.ke0 = 0.02;
    } else if (model === 'Pediatric (Scaled)') {
      // No published source; rough 5x scaling on a Jeleazcov-shape base. Unsourced approximation —
      // prefer Balyan (2020) for pediatric work. Kept for saved-scenario backward compat.
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
    // Reference: Ward RM et al. Paediatr Anaesth 2014;24:591-601. PMID:24666686.
    // "The pharmacokinetics of methadone and its metabolites in neonates, infants, and children."
    // Parameters match this paper exactly: V1=21.5L, V2=75.1L, V3=484L, CL=9.45 L/h/70kg,
    // Q2=325 L/h, Q3=136 L/h. CL/Q2/Q3 converted to L/min by /60.
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
      // Reference: Gepts E et al. Anesthesiology 1995;83:1194-1204. PMID:8533912.
      // "Linearity of pharmacokinetics and model estimation of sufentanil." Adult TCI standard.
      // V1=14.2 L, V2=40.0 L, V3=217 L, Cl=0.94 L/min, Q2=1.9 L/min, Q3=1.1 L/min.
      // ke0 not in original paper; 0.17 is the conventional TCI value (similar to Schnider/Minto range).
      params.V1 = 14.2;
      params.V2 = 40.0;
      params.V3 = 217.0;
      params.Cl = 0.94;
      params.Q2 = 1.9;
      params.Q3 = 1.1;
      params.ke0 = 0.17; // Common TCI value (e.g. Schnider/Minto range equivalent)
    } else if (model === 'Bartkowska-Sniatkowska (2016) PICU') {
      // Reference: Bartkowska-Sniatkowska A et al. J Clin Pharmacol 2016;56:109-115. PMID:26105145.
      // "Pharmacokinetics of sufentanil during long-term infusion in critically ill pediatric patients."
      // 2-compartment population PK. V1=11.5 L/70kg, V2=40 L/70kg. Cl=19.5 L/h/70kg, Q=15.3 L/h/70kg.
      // CL/Q converted to L/min by /60. ke0 estimated as 0.15 (peds adjacent to adult range).
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
  // --- REMIMAZOLAM ---
  else if (drug === 'Remimazolam') {
    // Reference: Eleveld DJ et al. Br J Anaesth 2025. PMC12597572 (open access).
    // "Development and analysis of a remimazolam pharmacokinetics and pharmacodynamics model."
    // Three-compartment + effect-site model from a pooled analysis of 20 studies including
    // Schüttler J et al. Anesthesiology 2020;132:636-651 (PMID:31972655). All numeric values
    // verified directly from the Eleveld 2025 PMC full text on 2026-04-29.
    //
    // Reference subject: 70-kg adult; allometric exponent 1.0 for V, 0.75 for CL/Q (standard).
    // ke0 = 0.298 /min selected as the MOAA/S endpoint (more clinically relevant for sedation
    //   depth than the BIS endpoint ke0 = 0.145 /min, which is also reported in the paper).
    // Ce50 anchors (not implemented here, see THERAPEUTIC_RANGES.bisTarget for the chart band):
    //   MOAA/S Ce50 = 0.182 mcg/mL,  BIS Ce50 = 0.982 mcg/mL.
    // Eleveld 2025 also reports covariate effects (female +16% CL, opioid -14% CL, age, hepatic,
    // renal, ECMO) — not included here, future enhancement.
    const wRatio = weight / 70;
    params.V1 = 4.31 * wRatio;
    params.V2 = 12.3 * wRatio;
    params.V3 = 18.6 * wRatio;
    params.Cl = 1.12  * (wRatio ** 0.75);
    params.Q2 = 1.45  * (wRatio ** 0.75);
    params.Q3 = 0.298 * (wRatio ** 0.75);
    params.ke0 = 0.298;
  }
  // --- KETAMINE ---
  else if (drug === 'Ketamine') {
    // Reference: Noppers I et al. Anesthesiology 2011;114:1435-45. PMC3560924 (open access).
    // "Effect of rifampicin on S-ketamine and S-norketamine plasma concentrations..."
    // S-ketamine three-compartment model — placebo-arm baseline values (Table 2). All
    // numeric parameters verified directly from PMC full text on 2026-04-29.
    //
    // IMPORTANT: This is the S-ketamine / esketamine model. Racemic ketamine has different
    // disposition (R-enantiomer clearance differs and norketamine contribution differs);
    // racemic Cp is NOT modelled here. The contextWarning in THERAPEUTIC_RANGES makes this
    // explicit in the UI.
    //
    // Reference subject: 70-kg adult; allometric V scales with W^1.0, CL/Q with W^0.75
    // (verbatim from the paper's "scaled via WT/70" wording).
    //
    // ke0 = 0 intentionally. Noppers 2011 modelled acute analgesia with sigmoid Emax linked
    // to plasma directly (no effect-site delay). PD endpoints (analgesia, sedation,
    // dissociation, EEG) need endpoint-specific models — no single ke0 captures all
    // clinical effects. The chart therefore renders Cp only with the 375 ng/mL heat-pain
    // reference line as an experimental anchor (THERAPEUTIC_RANGES.experimentalReferenceLine).
    const wRatio = weight / 70;
    params.V1 = 17.0 * wRatio;
    params.V2 = 28.3 * wRatio;
    params.V3 = 147  * wRatio;
    params.Cl = (93.5 / 60) * (wRatio ** 0.75); // L/h → L/min
    params.Q2 = (127  / 60) * (wRatio ** 0.75);
    params.Q3 = (91.9 / 60) * (wRatio ** 0.75);
    params.ke0 = 0;
  }
  // --- DEXMEDETOMIDINE ---
  else if (drug === 'Dexmedetomidine') {
    // Reference: Hannivoort LN, Eleveld DJ, Proost JH, Absalom AR, Vereecke H, Struys MMRF.
    // Anesthesiology 2015;123:357-367. PMID:26068206.
    // "Development of an Optimized Pharmacokinetic Model of Dexmedetomidine Using
    //  Target-Controlled Infusion in Healthy Volunteers."
    // Three-compartment allometric model. Weight is the only covariate identified by the authors.
    // Reference: 70-kg adult; allometric exponent 1.0 for volumes, 0.75 for clearances (standard).
    // PK values verified directly from the PubMed abstract on 2026-04-29.
    //
    // ke0 is intentionally 0: Hannivoort 2015 is a PK-only paper. The SedationChart consequently
    // shows Cp only by default and overlays the Cp-based clinical sedation bands from Weerink 2017
    // (PMC5511603). An explicit Advanced toggle in the chart UI re-derives Ce on the fly using the
    // Colin 2017 MOAA/S ke0 = 0.0428 /min (PMID:28854538), labelled as exploratory PKPD.
    const wRatio = weight / 70;
    params.V1 = 1.78 * wRatio;
    params.V2 = 30.3 * wRatio;
    params.V3 = 52.0 * wRatio;
    params.Cl = 0.686 * (wRatio ** 0.75);
    params.Q2 = 2.98  * (wRatio ** 0.75);
    params.Q3 = 0.602 * (wRatio ** 0.75);
    params.ke0 = 0;
  }
  // --- PROPOFOL ---
  else if (drug === 'Propofol') {
    if (model === 'Eleveld (2018) General-purpose') {
      // Eleveld DJ et al. Br J Anaesth 2018;120:942-959. PMID:29661412.
      // Full covariate model — see getEleveldPropofol() above for the equations and source notes.
      const eleveld = getEleveldPropofol(patient);
      params.V1 = eleveld.V1;
      params.V2 = eleveld.V2;
      params.V3 = eleveld.V3;
      params.Cl = eleveld.Cl;
      params.Q2 = eleveld.Q2;
      params.Q3 = eleveld.Q3;
      params.ke0 = eleveld.ke0;
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
