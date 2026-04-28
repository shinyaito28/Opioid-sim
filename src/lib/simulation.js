// 3-compartment + effect-site PK simulation engine.
// Pure function — no React, no DOM. Forward Euler with dt = 10 sec, samples at 1-min intervals.

const MG_DRUGS = ['Morphine', 'Hydromorphone', 'Methadone', 'Propofol'];

// Convert raw user-facing events (bolus / infusion with duration) into the lower-level event
// stream the simulator consumes (bolus / infusion_start with rate / infusion_stop with startId).
// `startId` lets concurrent infusions of the same drug be tracked individually so a stop event
// only removes its own infusion's contribution to the running rate (Phase 5-C bugfix).
export const processEvents = (drugEvents, simDuration) => {
  const out = [];
  drugEvents.forEach((evt) => {
    if (evt.type === 'bolus') {
      out.push(evt);
    } else if (evt.type === 'infusion') {
      out.push({ ...evt, type: 'infusion_start' });
      const effectiveDuration = evt.isInfinite
        ? Math.max(0, simDuration - evt.time + 60)
        : evt.duration;
      out.push({
        type: 'infusion_stop',
        time: evt.time + effectiveDuration,
        startId: evt.id,
        rate: 0,
      });
    }
  });
  return out;
};

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
  // Per-infusion-id rate map (Phase 5-C concurrent-infusion bug fix). Sum the active values
  // each step so two parallel infusions of the same drug accumulate correctly.
  const activeInfusions = new Map();

  const totalSteps = Math.floor(durationMinutes / dt);
  const stepsPerMin = Math.round(1 / dt);

  for (let step = 0; step <= totalSteps; step++) {
    const t = step * dt;

    while (eventIndex < eventQueue.length && eventQueue[eventIndex].time <= t) {
      const evt = eventQueue[eventIndex];

      if (evt.type === 'bolus') {
        x1 += evt.amount * scaleFactor;
      } else if (evt.type === 'infusion_start') {
        activeInfusions.set(evt.id, (evt.rate * scaleFactor) / 60);
      } else if (evt.type === 'infusion_stop') {
        activeInfusions.delete(evt.startId);
      }

      eventIndex++;
    }

    let currentInfusionRate = 0;
    for (const r of activeInfusions.values()) currentInfusionRate += r;

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
