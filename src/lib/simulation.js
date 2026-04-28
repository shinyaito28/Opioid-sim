// 3-compartment + effect-site PK simulation engine.
// Pure function — no React, no DOM. Forward Euler with dt = 10 sec, samples at 1-min intervals.
// Phase 5-C will replace the single-scalar `currentInfusionRate` with a Map<infusionId, rate>
// so concurrent infusions of the same drug sum correctly (current implementation has a known bug:
// a second infusion_start overwrites the first, and any infusion_stop zeroes them all).

const MG_DRUGS = ['Morphine', 'Hydromorphone', 'Methadone'];

export const simulateConcentration = (events, params, durationMinutes, drugType) => {
  const { V1, V2, V3, Cl, Q2, Q3, ke0 } = params;

  if (!V1 || V1 <= 0) return [];

  const k10 = Cl / V1;
  const k12 = (V2 > 0) ? Q2 / V1 : 0;
  const k21 = (V2 > 0) ? Q2 / V2 : 0;

  const k13 = (V3 > 0) ? Q3 / V1 : 0;
  const k31 = (V3 > 0) ? Q3 / V3 : 0;

  const isMgDrug = MG_DRUGS.includes(drugType);
  const scaleFactor = isMgDrug ? 1000 : 1;

  let x1 = 0, x2 = 0, x3 = 0, xe = 0;
  const data = [];
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
    const dCe = (ke0 * (cp - xe)) * dt;

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
