/**
 * Phase 5-J-3 — Opioid burden as cumulative effect-site exposure.
 *
 * The right-axis "Burden Index" curve shown on the main chart (Σ Ce/RespC50) is an
 * **instantaneous** respiratory-risk indicator — at any given minute it answers
 * "how close are we to the respiratory-depression threshold?". This module adds
 * the complementary **cumulative** view via area-under-curve of the effect-site
 * concentration:
 *
 *   total_AUC        = ∫₀ᵀ Ce(t) dt
 *   therapeutic_AUC  = ∫ max(0, min(Ce, analgesiaMax) - analgesiaMin) dt
 *                      // exposure within the analgesic band
 *   supra_AUC        = ∫ max(0, Ce - analgesiaMax) dt
 *                      // overshoot above the upper analgesic threshold
 *
 * Trapezoidal rule on the 1-minute-sampled output of simulateConcentration.
 * Unit: (ng/mL) · min when Ce is in ng/mL. Drug-summed; opioids only (sedatives
 * use bisTarget / sedationBands which are not analgesia-based).
 */

export function computeBurdenAUC(simData, range) {
  let total = 0;
  let therapeutic = 0;
  let supra = 0;
  if (!Array.isArray(simData) || simData.length < 2) {
    return { total: 0, therapeutic: 0, supra: 0 };
  }
  const aMin = range?.analgesiaMin;
  const aMax = range?.analgesiaMax;
  const hasBand = aMin != null && aMax != null;

  for (let i = 0; i < simData.length - 1; i++) {
    const c1 = simData[i].ce ?? 0;
    const c2 = simData[i + 1].ce ?? 0;
    // 1-minute step → trapezoid area = (c1 + c2) / 2 * 1
    total += (c1 + c2) / 2;
    if (hasBand) {
      // Therapeutic AUC: clip Ce to [aMin, aMax], then subtract aMin so the area
      // counted is the height above aMin within the band.
      const cl1 = Math.min(Math.max(c1, aMin), aMax) - aMin;
      const cl2 = Math.min(Math.max(c2, aMin), aMax) - aMin;
      therapeutic += (cl1 + cl2) / 2;
      // Supratherapeutic AUC: max(0, Ce - aMax)
      const s1 = Math.max(0, c1 - aMax);
      const s2 = Math.max(0, c2 - aMax);
      supra += (s1 + s2) / 2;
    }
  }
  return { total, therapeutic, supra };
}
