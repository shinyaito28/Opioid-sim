import React from 'react';
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

// Inline tooltip — mirrors App.jsx's ChartTooltip but scoped to a single drug.
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

  if (!sim || sim.length === 0) return null;

  const colors = DRUG_COLORS[drug] || { ce: '#0d9488', cp: '#5eead4' };
  const shortName = DRUG_SHORT_NAMES[drug] || drug;
  const displayUnit = DRUG_DISPLAY[drug]?.unit || 'ng/mL';
  const divisor = DRUG_DISPLAY[drug]?.divisor || 1;
  const displaySim = divisor === 1
    ? sim
    : sim.map((p) => ({ time: p.time, cp: p.cp / divisor, ce: p.ce / divisor }));

  const bisTarget = THERAPEUTIC_RANGES[drug]?.bisTarget;
  const sedationTarget = THERAPEUTIC_RANGES[drug]?.sedationTarget;
  const targetBand = bisTarget || sedationTarget;

  return (
    <div className="glass rounded-xl p-3 border border-slate-200/60 shadow-sm">
      <h4 className="text-xs font-semibold text-slate-700 mb-1">
        {shortName} — {t('sedationMonitor')}
      </h4>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {/* margin + axis widths intentionally match the main chart so the X axis
              left/right edges line up across both — left YAxis default width (~60),
              right spacer width=40 mirrors the main chart's Burden axis. */}
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
              domain={[0, 'auto']}
              label={{ value: `Conc (${displayUnit})`, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              fontSize={10}
            />
            {/* Invisible right-side YAxis — reserves the same 40px slot the main
                chart's Burden axis occupies, keeping X edges aligned. */}
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

            {targetBand && (
              <ReferenceArea
                yAxisId="left"
                y1={targetBand.min}
                y2={targetBand.max}
                fill={colors.ce}
                fillOpacity={0.10}
              />
            )}

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

            {isClockMode && currentSimMinutes != null && currentSimMinutes >= 0 && currentSimMinutes <= simDuration && (
              <ReferenceLine yAxisId="left" x={currentSimMinutes} stroke="#ef4444" strokeDasharray="3 3" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
