import { finite, validateDuration, validateEvent, validateParams, MAX_SIM_MINUTES } from './validation.js';
const MG_DRUGS = ['Morphine', 'Hydromorphone', 'Methadone', 'Propofol', 'Remimazolam', 'Ketamine'];
export function processEvents(events, duration) {
  validateDuration(duration);
  if (!Array.isArray(events)) throw new TypeError('Invalid events');
  const ids = new Set();
  return events.flatMap(e => {
    validateEvent(e);
    if (ids.has(e.id)) throw new RangeError('Duplicate event ID');
    ids.add(e.id);
    return e.type === 'bolus' ? [e] : [{
      ...e,
      type: 'infusion_start'
    }, ...(e.isInfinite ? [] : [{
      type: 'infusion_stop',
      time: e.time + e.duration,
      startId: e.id
    }])];
  });
}
// RK4, event-aligned segments. Mass mcg; volume L; clearance L/min; time min.
// Labels match the sampled state. ke0=0 returns Ce=null (model unavailable).
export function simulateConcentration(events, p, duration, drug) {
  validateDuration(duration);
  validateParams(p);
  const {
    V1,
    V2,
    V3,
    Cl,
    Q2,
    Q3,
    ke0
  } = p;
  const k10 = Cl / V1,
    k12 = V2 ? Q2 / V1 : 0,
    k21 = V2 ? Q2 / V2 : 0,
    k13 = V3 ? Q3 / V1 : 0,
    k31 = V3 ? Q3 / V3 : 0;
  const scale = MG_DRUGS.includes(drug) ? 1000 : 1,
    queue = [...events].sort((a, b) => a.time - b.time);
  for (const e of queue) {
    finite(e.time, 'event time', {
      min: -MAX_SIM_MINUTES
    });
    if (e.type === 'bolus') finite(e.amount, 'dose', {
      positive: true
    });else if (e.type === 'infusion_start') {
      finite(e.rate, 'rate');
      if (e.id == null) throw new TypeError('Missing infusion ID');
    } else if (e.type === 'infusion_stop') {
      if (e.startId == null) throw new TypeError('Missing stop ID');
    } else throw new TypeError('Invalid processed event');
  }
  let x = [0, 0, 0, 0],
    index = 0,
    time = Math.min(0, queue[0]?.time ?? 0);
  const active = new Map(),
    data = [];
  const maxStep = Math.min(1 / 6, .1 / Math.max(k10 + k12 + k13, k21, k31, ke0, 1e-12));
  if (!Number.isFinite(maxStep) || (duration - time) / maxStep > 1e6) throw new RangeError('Parameters exceed numerical integration limits');
  const f = (v, r) => [r - (k10 + k12 + k13) * v[0] + k21 * v[1] + k31 * v[2], k12 * v[0] - k21 * v[1], k13 * v[0] - k31 * v[2], ke0 * (v[0] / V1 - v[3])];
  const advance = target => {
    const rate = [...active.values()].reduce((s, v) => s + v, 0);
    while (time < target - 1e-10) {
      const h = Math.min(maxStep, target - time),
        a = f(x, rate),
        b = f(x.map((v, i) => v + h * a[i] / 2), rate),
        c = f(x.map((v, i) => v + h * b[i] / 2), rate),
        d = f(x.map((v, i) => v + h * c[i]), rate);
      x = x.map((v, i) => v + h * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
      if (x.some(v => !Number.isFinite(v) || v < -1e-8)) throw new RangeError('Nonphysical simulation state');
      x = x.map(v => Math.max(0, v));
      time += h;
    }
    time = target;
  };
  const through = target => {
    while (index < queue.length && queue[index].time <= target + 1e-10) {
      const et = queue[index].time;
      advance(et);
      while (index < queue.length && Math.abs(queue[index].time - et) < 1e-10) {
        const e = queue[index++];
        if (e.type === 'bolus') x[0] += e.amount * scale;else if (e.type === 'infusion_start') {
          if (active.has(e.id)) throw new RangeError('Duplicate active infusion ID');
          active.set(e.id, e.rate * scale / 60);
        } else active.delete(e.startId);
      }
    }
    advance(target);
    if (x.some(v => !Number.isFinite(v)) || !Number.isFinite(x[0] / V1)) throw new RangeError('Nonfinite simulation state');
    data.push({
      time: target,
      cp: x[0] / V1,
      ce: ke0 > 0 ? x[3] : null
    });
  };
  for (let t = 0; t <= Math.floor(duration); t++) through(t);
  if (!Number.isInteger(duration)) through(duration);
  return data;
}
