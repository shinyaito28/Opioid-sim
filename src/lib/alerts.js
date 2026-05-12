/**
 * Phase 5-L-4 — Rule-based clinical alerts for the active opioid simulation.
 *
 * computeAlerts(simByDrug, ranges, events, activeOpioids, simDuration) inspects
 * the per-drug 1-min effect-site concentration series along with the literature
 * therapeutic ranges and emits a list of structured alerts the UI can render.
 *
 * Alerts are ADVISORY only — they translate the same numbers the chart already
 * shows into short clinical-style sentences ("severe respiratory depression
 * predicted"). They are NOT a substitute for bedside judgement; the UI must
 * carry a disclaimer.
 *
 * Each alert: { id, level: 'red' | 'amber' | 'green', titleKey, bodyKey,
 *   bodyParams?: object, drug?: string }
 *
 * IDs are stable so React can key on them; identical conditions produce the
 * same id and so don't churn keys across re-renders.
 */

// Threshold constants (centralised so they show up in one place).
const RED_DURATION_MIN = 5;          // sustained-respiratory-depression window
const DEEP_DEPRESSION_FRACTION = 0.7; // R/(1+R) — 70% ventilatory depression
const RECOVERY_GAP_MIN = 30;         // "post-last-dose, analgesia waning"
const NARROW_WINDOW_RATIO = 1.5;     // analgesiaMin / respC50 — HM is ~1.2 → flagged

export function computeAlerts({ simByDrug, ranges, events, activeOpioids, simDuration }) {
  const alerts = [];
  if (!activeOpioids || activeOpioids.length === 0) return alerts;

  // Per-drug analysis.
  for (const drug of activeOpioids) {
    const sim = simByDrug.get(drug);
    const range = ranges[drug];
    if (!sim || !sim.length || !range) continue;
    const { analgesiaMin, analgesiaMax, respiratoryRisk } = range;

    // Peak Ce + threshold-crossing analysis.
    let peakCe = 0;
    let peakAt = 0;
    let consecAboveResp = 0;
    let maxConsecAboveResp = 0;
    let everReachedAnalgesia = false;
    let lastAboveAnalgesiaMin = -1;
    for (const p of sim) {
      const ce = p.ce ?? 0;
      if (ce > peakCe) { peakCe = ce; peakAt = p.time; }
      if (respiratoryRisk != null && ce >= respiratoryRisk) {
        consecAboveResp += 1;
        if (consecAboveResp > maxConsecAboveResp) maxConsecAboveResp = consecAboveResp;
      } else {
        consecAboveResp = 0;
      }
      if (analgesiaMin != null && ce >= analgesiaMin) {
        everReachedAnalgesia = true;
        lastAboveAnalgesiaMin = p.time;
      }
    }

    // 🔴 Sustained respiratory depression — Ce ≥ respC50 for ≥ 5 consecutive min.
    if (respiratoryRisk != null && maxConsecAboveResp >= RED_DURATION_MIN) {
      alerts.push({
        id: `${drug}-sustainedResp`,
        level: 'red',
        drug,
        titleKey: 'alertSustainedRespTitle',
        bodyKey: 'alertSustainedRespBody',
        bodyParams: { drug, minutes: maxConsecAboveResp, threshold: respiratoryRisk },
      });
    }

    // 🟡 Peak Ce never reached the analgesic range (undertreatment).
    if (analgesiaMin != null && !everReachedAnalgesia) {
      alerts.push({
        id: `${drug}-undertreatment`,
        level: 'amber',
        drug,
        titleKey: 'alertUndertreatmentTitle',
        bodyKey: 'alertUndertreatmentBody',
        bodyParams: { drug, peak: peakCe.toFixed(2), threshold: analgesiaMin },
      });
    }

    // 🟡 Hydromorphone (or any drug) where analgesiaMin sits above respiratoryRisk
    // — Olofsen 2026 finding for HM. Tell the user the therapeutic window is
    // inverted and any analgesic dosing risks resp depression first.
    if (
      analgesiaMin != null &&
      respiratoryRisk != null &&
      analgesiaMin > respiratoryRisk
    ) {
      alerts.push({
        id: `${drug}-invertedWindow`,
        level: 'amber',
        drug,
        titleKey: 'alertInvertedWindowTitle',
        bodyKey: 'alertInvertedWindowBody',
        bodyParams: { drug, analgesia: analgesiaMin, resp: respiratoryRisk },
      });
    }

    // 🟡 Analgesia waning — Ce currently below analgesiaMin AND the last time
    // it was above is > RECOVERY_GAP_MIN ago AND the patient previously had
    // analgesia. Useful for "is it time for the next dose?".
    if (
      analgesiaMin != null &&
      everReachedAnalgesia &&
      lastAboveAnalgesiaMin >= 0 &&
      simDuration - lastAboveAnalgesiaMin >= RECOVERY_GAP_MIN &&
      (sim[sim.length - 1]?.ce ?? 0) < analgesiaMin
    ) {
      alerts.push({
        id: `${drug}-waning`,
        level: 'amber',
        drug,
        titleKey: 'alertWaningTitle',
        bodyKey: 'alertWaningBody',
        bodyParams: { drug, sinceMin: simDuration - lastAboveAnalgesiaMin },
      });
    }
  }

  // Aggregate alerts that need the combined depression curve.
  // 🔴 Σ Ce/respC50 → R/(1+R) > 0.7 anywhere (severe combined depression).
  let maxDepression = 0;
  let maxDepressionAt = 0;
  const len = simDuration + 1;
  for (let t = 0; t < len; t++) {
    let R = 0;
    for (const drug of activeOpioids) {
      const sim = simByDrug.get(drug);
      const point = sim?.[t];
      if (!point) continue;
      const respRisk = ranges[drug]?.respiratoryRisk;
      if (!respRisk) continue;
      R += (point.ce || 0) / respRisk;
    }
    const dep = R / (1 + R);
    if (dep > maxDepression) { maxDepression = dep; maxDepressionAt = t; }
  }
  if (maxDepression >= DEEP_DEPRESSION_FRACTION) {
    alerts.push({
      id: 'combined-severeDepression',
      level: 'red',
      titleKey: 'alertSevereDepressionTitle',
      bodyKey: 'alertSevereDepressionBody',
      bodyParams: { fraction: Math.round(maxDepression * 100), at: maxDepressionAt },
    });
  }

  return alerts;
}
