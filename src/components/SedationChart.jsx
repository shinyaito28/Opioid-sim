import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Label,
} from 'recharts';
import {
  THERAPEUTIC_RANGES,
  DRUG_COLORS,
  DRUG_SHORT_NAMES,
  DRUG_DISPLAY,
  getDoseUnitForDrug,
} from '../lib/drugs';

// Local copy of App.jsx's clock-mode formatter — kept in-component so this chart can
// render its own X axis without coupling to App internals.
const minutesToTime = (minutes, startStr) => {
  if (!startStr) return '00:00';
  const [sh, sm] = startStr.split(':').map(Number);
  const totalMin = sh * 60 + sm + minutes;
  let h = Math.floor(totalMin / 60) % 24;
  if (h < 0) h += 24;
  let m = Math.floor(totalMin % 60);
  if (m < 0) m += 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Forward-Euler Ce derivation from a Cp series for advanced/research mode.
// Used when a drug's primary PK paper does not include a PD/effect-site model
// (e.g., Hannivoort 2015 Dex) but a separate exploratory ke0 is documented and
// the user opts in via the Advanced toggle.
const computeCeFromCp = (sim, ke0) => {
  if (!ke0 || ke0 <= 0 || !sim || sim.length < 2) {
    return sim.map((p) => ({ ...p, ce: 0 }));
  }
  let ce = 0;
  const dt = 1; // 1-min sample spacing matches simulation.js output cadence
  return sim.map((p) => {
    const dce = ke0 * ((p.cp || 0) - ce) * dt;
    ce += dce;
    return { time: p.time, cp: p.cp, ce: parseFloat(ce.toFixed(3)) };
  });
};

const SedationTooltip = ({ active, payload, label, events, drug, isClockMode, startTime, displayUnit }) => {
  if (!active || !payload || payload.length === 0) return null;
  const time = Number(label);
  const headerLabel = isClockMode
    ? `${minutesToTime(time, startTime)} (${time} min)`
    : `${time} min`;

  const nearbyEvents = events.filter((e) => {
    if (e.type === 'bolus') return Math.abs(e.time - time) <= 0.5;
    if (e.type === 'infusion') {
      const endTime = e.isInfinite ? Infinity : e.time + e.duration;
      return time >= e.time - 0.5 && time <= endTime + 0.5;
    }
    return false;
  });

  const evtUnit = getDoseUnitForDrug(drug);
  const evtShort = DRUG_SHORT_NAMES[drug] || drug;

  return (
    <div className="bg-white/95 border border-slate-200 rounded-lg shadow p-2 text-xs min-w-[140px]">
      <div className="font-semibold text-slate-700 mb-1">{headerLabel}</div>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex justify-between gap-3" style={{ color: entry.color }}>
          <span>{entry.name}</span>
          <span className="font-mono font-bold">
            {entry.value?.toFixed?.(2) ?? entry.value} {displayUnit}
          </span>
        </div>
      ))}
      {nearbyEvents.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-200 space-y-0.5">
          {nearbyEvents.map((e) => {
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

// Sedation band fill colours by clinical severity. Dex uses both; Propofol's bisTarget falls back
// to the drug's accent (teal) since it represents a target rather than a danger zone.
const BAND_COLORS = {
  light: { fill: '#0d9488', opacity: 0.13 }, // teal — gentle / target zone
  deep:  { fill: '#f59e0b', opacity: 0.13 }, // amber — caution / deep sedation
};

export default function SedationChart({
  drug,
  sim,
  events,
  simDuration,
  isClockMode,
  startTime,
  currentSimMinutes,
}) {
  const { t } = useTranslation();
  const range = THERAPEUTIC_RANGES[drug] || {};
  const advancedKe0 = range.advancedKe0;
  const cpOnlyDefault = !!range.sedationBands && !range.bisTarget;
  const yPresets = DRUG_DISPLAY[drug]?.yPresets || [];

  // Advanced toggle is per-drug-instance state. Shown only when the drug declares an advancedKe0.
  const [showAdvancedCe, setShowAdvancedCe] = useState(false);
  // Y-axis zoom — 'auto' or numeric ceiling in display units. Lets the user clamp the axis to the
  // therapeutic-band range so brief Cp spikes (e.g. Dex bolus initial 30-50 ng/mL) don't squash
  // the 0.2-1.9 ng/mL band into the bottom 5% of the chart.
  const [yMax, setYMax] = useState('auto');

  if (!sim || sim.length === 0) return null;

  const colors = DRUG_COLORS[drug] || { ce: '#0d9488', cp: '#5eead4' };
  const shortName = DRUG_SHORT_NAMES[drug] || drug;
  const displayUnit = DRUG_DISPLAY[drug]?.unit || 'ng/mL';
  const divisor = DRUG_DISPLAY[drug]?.divisor || 1;

  // Step 1: scale internal ng/mL to display unit (e.g., Propofol mcg/mL).
  const scaledSim = useMemo(() => (
    divisor === 1
      ? sim
      : sim.map((p) => ({ time: p.time, cp: p.cp / divisor, ce: p.ce / divisor }))
  ), [sim, divisor]);

  // Step 2: if Cp-only drug AND advanced toggle is on, derive Ce from Cp via the documented
  // exploratory ke0. Otherwise use whatever the PK engine produced (real Ce for Propofol,
  // 0 for Dex default mode).
  const displaySim = useMemo(() => {
    if (cpOnlyDefault && showAdvancedCe && advancedKe0) {
      return computeCeFromCp(scaledSim, advancedKe0);
    }
    return scaledSim;
  }, [scaledSim, cpOnlyDefault, showAdvancedCe, advancedKe0]);

  const showCeLine = !cpOnlyDefault || (showAdvancedCe && advancedKe0);

  return (
    <div className="glass rounded-xl p-3 border border-slate-200/60 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-2 mb-1">
        <h4 className="text-xs font-semibold text-slate-700">
          {shortName} — {t('sedationMonitor')}
        </h4>
        <div className="flex flex-wrap items-center gap-1">
          {yPresets.length > 0 && (
            <div className="flex items-center gap-0.5 mr-1">
              <span className="text-[9px] text-slate-500 mr-0.5">Y</span>
              <button
                type="button"
                onClick={() => setYMax('auto')}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  yMax === 'auto'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Auto
              </button>
              {yPresets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setYMax(p)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    yMax === p
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ≤{p}
                </button>
              ))}
            </div>
          )}
          {advancedKe0 && (
            <button
              type="button"
              onClick={() => setShowAdvancedCe((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                showAdvancedCe
                  ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
              }`}
              title={range.advancedKe0Source || ''}
            >
              {showAdvancedCe ? t('sedationCeOn') : t('sedationCeOff')}
            </button>
          )}
        </div>
      </div>

      {showAdvancedCe && advancedKe0 && (
        <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-1.5">
          {t('sedationAdvancedCeNote', { source: range.advancedKe0Source, ke0: advancedKe0 })}
        </div>
      )}

      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displaySim} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="time"
              type="number"
              domain={[0, simDuration]}
              tickCount={10}
              allowDataOverflow
              tickFormatter={(val) => isClockMode ? minutesToTime(val, startTime) : val}
              fontSize={10}
            />
            <YAxis
              yAxisId="left"
              domain={[0, yMax === 'auto' ? 'auto' : yMax]}
              allowDataOverflow={yMax !== 'auto'}
              label={{ value: `Conc (${displayUnit})`, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              fontSize={10}
            />
            <YAxis yAxisId="burden-spacer" orientation="right" width={40} hide />
            <Tooltip
              content={
                <SedationTooltip
                  events={events}
                  drug={drug}
                  isClockMode={isClockMode}
                  startTime={startTime}
                  displayUnit={displayUnit}
                />
              }
            />

            {/* Single BIS target band (Propofol) — drawn on the same left axis as the Ce line. */}
            {range.bisTarget && (
              <ReferenceArea
                yAxisId="left"
                y1={range.bisTarget.min}
                y2={range.bisTarget.max}
                fill={colors.ce}
                fillOpacity={0.10}
              />
            )}

            {/* Multi-band sedation overlay (Dex) — Cp-axis bands derived from clinical literature. */}
            {range.sedationBands && range.sedationBands.map((band, i) => {
              const c = BAND_COLORS[band.kind] || { fill: colors.ce, opacity: 0.10 };
              return (
                <ReferenceArea
                  key={`sed-band-${i}`}
                  yAxisId="left"
                  y1={band.min}
                  y2={band.max}
                  fill={c.fill}
                  fillOpacity={c.opacity}
                  ifOverflow="hidden"
                />
              );
            })}

            {events.flatMap((evt) => {
              const evtUnit = getDoseUnitForDrug(drug);
              if (evt.type === 'bolus') {
                const bolusText = `${shortName} ${evt.amount}${evtUnit}`;
                return [
                  <ReferenceLine
                    key={`evt-bolus-${evt.id}`}
                    yAxisId="left"
                    x={evt.time}
                    stroke={colors.ce}
                    strokeWidth={1.2}
                    strokeDasharray="2 3"
                    ifOverflow="extendDomain"
                  >
                    <Label value="▼" position="top" fill={colors.ce} fontSize={11} fontWeight="bold" offset={2} />
                    <Label value={bolusText} position="insideTopLeft" fill={colors.ce} fontSize={9} fontWeight="bold" offset={4} />
                  </ReferenceLine>,
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
                    strokeWidth={1.2}
                    strokeDasharray="3 2"
                    ifOverflow="extendDomain"
                  >
                    <Label value={inflText} position="insideTopLeft" fill={colors.ce} fontSize={9} fontWeight="bold" offset={4} dy={14} />
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
                      <Label value="◀" position="insideTopRight" fill={colors.ce} fontSize={10} offset={4} dy={14} />
                    </ReferenceLine>
                  ),
                ].filter(Boolean);
              }
              return [];
            })}

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cp"
              name={`Cp ${shortName}`}
              stroke={colors.cp}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
            />
            {showCeLine && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ce"
                name={`Ce ${shortName}`}
                stroke={colors.ce}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {isClockMode && currentSimMinutes != null && currentSimMinutes >= 0 && currentSimMinutes <= simDuration && (
              <ReferenceLine yAxisId="left" x={currentSimMinutes} stroke="#ef4444" strokeDasharray="3 3" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {range.contextWarningKey && (
        <p className="text-[10px] text-slate-500 italic mt-1.5 leading-tight">
          {t(range.contextWarningKey)}
        </p>
      )}
    </div>
  );
}
