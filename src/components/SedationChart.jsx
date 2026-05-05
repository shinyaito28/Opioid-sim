import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn } from 'lucide-react';
import ChartEventPopover from './ChartEventPopover';
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
    <div className="bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 dark:border-slate-600 rounded-lg shadow p-2 text-xs min-w-[140px]">
      <div className="font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-200 mb-1">{headerLabel}</div>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex justify-between gap-3" style={{ color: entry.color }}>
          <span>{entry.name}</span>
          <span className="font-mono font-bold">
            {entry.value?.toFixed?.(2) ?? entry.value} {displayUnit}
          </span>
        </div>
      ))}
      {nearbyEvents.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700 dark:border-slate-600 space-y-0.5">
          {nearbyEvents.map((e) => {
            const evtTimeLabel = isClockMode ? minutesToTime(e.time, startTime) : `${e.time}min`;
            if (e.type === 'bolus') {
              return (
                <div key={e.id} className="text-[10px] text-purple-700 dark:text-purple-300">
                  <span className="font-bold">▼</span> {evtShort} {e.amount}{evtUnit} @{evtTimeLabel}
                </div>
              );
            }
            const rateText = e.originalRate && e.originalUnit
              ? `${e.originalRate} ${e.originalUnit}`
              : `${e.rate}/hr`;
            const durLabel = e.isInfinite ? '∞' : `${e.duration}min`;
            return (
              <div key={e.id} className="text-[10px] text-orange-700 dark:text-orange-300">
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
  // Phase 5-H-2: chart-click popover support — pass through from App.jsx to reuse existing
  // event-add handlers. When omitted the chart simply has no click-to-add behaviour.
  drugList,
  drugUnits,
  drugShortNames,
  clinicalDefaults,
  lastDoseByDrug,
  quickAddBolus,
  quickAddInfusion,
  // Phase 5-H-3 (B): edit-mode handlers from App.jsx. When supplied, tapping near an existing
  // event marker opens the popover in edit mode with Update/Delete buttons.
  onUpdate,
  onDelete,
  // Phase 5-H-4: drag-to-reschedule. Receives (eventId, newTime) and updates the parent's
  // events array. Drag is enabled only when this prop is supplied.
  onEventTimeChange,
  // Phase 5-H-7: drag end-marker (◀) horizontally to change infusion duration.
  onEventDurationChange,
  // Phase 5-I-1: shared theme colours from App.jsx so the Recharts axis / grid /
  // tooltip border match the active light/dark mode without each chart re-deriving them.
  chartColors,
}) {
  const { t } = useTranslation();
  const range = THERAPEUTIC_RANGES[drug] || {};
  const advancedKe0 = range.advancedKe0;
  const disabledCe = range.disabledCe;
  // Cp-only when the drug declares sedationBands instead of bisTarget (Dex), or explicitly
  // disables Ce (Ketamine — endpoint-specific PD, no single ke0).
  const cpOnlyDefault = (!!range.sedationBands && !range.bisTarget) || !!disabledCe;
  const yDefaultMax = DRUG_DISPLAY[drug]?.yDefaultMax || 10;
  const yMaxLimit = DRUG_DISPLAY[drug]?.yMaxLimit || 50;
  // Hoisted up from below so Phase 5-J-1 yAxisInfo can use it for data-peak scaling.
  const divisor = DRUG_DISPLAY[drug]?.divisor || 1;

  // Advanced toggle is per-drug-instance state. Shown only when the drug declares an advancedKe0.
  const [showAdvancedCe, setShowAdvancedCe] = useState(false);
  // Phase 5-J-1: Y-axis display mode. 'therapeutic' default keeps the bisTarget /
  // sedationBands visible regardless of PK peak; 'full' is data-peak fit; 'custom'
  // honours the slider value below. Sqrt-mapped slider gives fine PD-range resolution.
  const [yMode, setYMode] = useState('therapeutic'); // 'full' | 'therapeutic' | 'custom'
  const [yMax, setYMax] = useState(yDefaultMax);
  const sliderMax = Math.round(Math.sqrt(yMaxLimit) * 10);

  // Phase 5-J-1: data peak + Y-axis effective max (in display units, after divisor).
  // 'therapeutic' keeps bisTarget.max or sedationBands top visible; 'full' fits the
  // data peak; 'custom' honours the slider value.
  const yAxisInfo = useMemo(() => {
    let dataPeak = 0;
    let peakTime = 0;
    if (sim?.length) {
      for (const point of sim) {
        const v = (point.ce ?? point.cp ?? 0) / divisor;
        if (v > dataPeak) { dataPeak = v; peakTime = point.time; }
      }
    }
    let yMaxLocal;
    if (yMode === 'custom') {
      yMaxLocal = yMax;
    } else if (yMode === 'full') {
      yMaxLocal = dataPeak <= 0 ? yDefaultMax : Math.ceil(dataPeak * 1.2 * 10) / 10;
    } else if (range?.bisTarget?.max) {
      yMaxLocal = Math.max(range.bisTarget.max * 1.5, 1);
    } else if (range?.sedationBands?.length) {
      const upper = Math.max(...range.sedationBands.map((b) => b.max));
      yMaxLocal = Math.max(upper * 1.2, 1);
    } else if (range?.experimentalReferenceLine?.value) {
      yMaxLocal = Math.max(range.experimentalReferenceLine.value * 1.2 / divisor, 1);
    } else {
      yMaxLocal = dataPeak <= 0 ? yDefaultMax : Math.ceil(dataPeak * 1.2 * 10) / 10;
    }
    return { yMaxEffective: yMaxLocal, dataPeak, peakTime };
  }, [yMode, yMax, sim, divisor, range, yDefaultMax]);
  const yMaxEffective = yAxisInfo.yMaxEffective;

  // Phase 5-H-2: chart-click popover anchored to the mini chart container.
  // Phase 5-H-3 (B) added editingEventId for edit-mode popover.
  const [popover, setPopover] = useState({ open: false, x: 0, y: 0, minute: 0, editingEventId: null });
  const chartAreaRef = useRef(null);
  const clickEnabled = typeof quickAddBolus === 'function' && typeof quickAddInfusion === 'function';
  // Phase 5-H-4: drag-to-reschedule on this mini chart. Same pattern as the main chart in
  // App.jsx — the px→minute conversion uses a fixed PLOT_RIGHT_OFFSET=50 because there is
  // no Burden axis here. Live updates flow through onEventTimeChange.
  const dragEnabled = typeof onEventTimeChange === 'function';
  const dragStateRef = useRef(null);
  const dragEndTimeRef = useRef(0);
  const DRAG_THRESHOLD_PX = 5;
  const SUPPRESS_CLICK_MS = 500;
  const pxToMinuteSed = (xPx, rectWidth) => {
    const PLOT_LEFT = 60;
    const PLOT_RIGHT_OFFSET = 50;
    if (xPx < PLOT_LEFT || xPx > rectWidth - PLOT_RIGHT_OFFSET) return null;
    const xRatio = (xPx - PLOT_LEFT) / (rectWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET);
    return Math.max(0, Math.min(simDuration, Math.round(xRatio * simDuration)));
  };
  const durationDragEnabled = typeof onEventDurationChange === 'function';
  const onChartPointerDown = (e) => {
    if (!dragEnabled) return;
    const rect = chartAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const minute = pxToMinuteSed(x, rect.width);
    if (minute === null) return;
    // Phase 5-H-7: end-marker priority for duration drag. Wider tolerance (±2 min)
    // so the thin ◀ is grabbable even on touch.
    if (durationDragEnabled) {
      const endHit = events.find((ev) => {
        if (ev.type !== 'infusion' || ev.isInfinite) return false;
        const endTime = ev.time + ev.duration;
        return Math.abs(endTime - minute) <= 2;
      });
      if (endHit) {
        dragStateRef.current = {
          eventId: endHit.id,
          pointerId: e.pointerId,
          startX: x,
          startMinute: minute,
          originalTime: endHit.time,
          originalDuration: endHit.duration,
          mode: 'duration',
          didDrag: false,
        };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }
    }
    const nearby = events.find((ev) => {
      if (ev.type === 'bolus') return Math.abs(ev.time - minute) <= 1;
      if (ev.type === 'infusion') {
        const endTime = ev.isInfinite ? simDuration : ev.time + ev.duration;
        return minute >= ev.time - 1 && minute <= endTime + 1;
      }
      return false;
    });
    if (!nearby) return;
    dragStateRef.current = {
      eventId: nearby.id,
      pointerId: e.pointerId,
      startX: x,
      startMinute: minute,
      originalTime: nearby.time,
      originalDuration: nearby.duration,
      mode: 'time',
      didDrag: false,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const onChartPointerMove = (e) => {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    const rect = chartAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    if (!ds.didDrag) {
      if (Math.abs(x - ds.startX) < DRAG_THRESHOLD_PX) return;
      ds.didDrag = true;
    }
    const currentMinute = pxToMinuteSed(x, rect.width);
    if (currentMinute === null) return;
    const delta = currentMinute - ds.startMinute;
    if (ds.mode === 'duration') {
      const newDuration = Math.max(1, ds.originalDuration + delta);
      onEventDurationChange(ds.eventId, newDuration);
    } else {
      const newTime = Math.max(0, Math.min(simDuration, ds.originalTime + delta));
      onEventTimeChange(ds.eventId, newTime);
    }
  };
  const onChartPointerUp = (e) => {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    if (ds.didDrag) dragEndTimeRef.current = Date.now();
    dragStateRef.current = null;
  };
  const onChartPointerCancel = (e) => {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    if (ds.didDrag) {
      if (ds.mode === 'duration' && durationDragEnabled) {
        onEventDurationChange(ds.eventId, ds.originalDuration);
      } else if (dragEnabled) {
        onEventTimeChange(ds.eventId, ds.originalTime);
      }
    }
    dragStateRef.current = null;
  };

  // Phase 5-H-3 (B): find an existing event near the clicked minute. The events array passed
  // to this chart is already drug-filtered upstream, so no extra filter needed here.
  const findEventNearMinute = (minute) => events.find((ev) => {
    if (ev.type === 'bolus') return Math.abs(ev.time - minute) <= 1;
    if (ev.type === 'infusion') {
      const endTime = ev.isInfinite ? simDuration : ev.time + ev.duration;
      return minute >= ev.time - 1 && minute <= endTime + 1;
    }
    return false;
  });

  if (!sim || sim.length === 0) return null;

  const colors = DRUG_COLORS[drug] || { ce: '#0d9488', cp: '#5eead4' };
  const shortName = DRUG_SHORT_NAMES[drug] || drug;
  const displayUnit = DRUG_DISPLAY[drug]?.unit || 'ng/mL';
  // (divisor declared earlier so yAxisInfo can use it.)

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

  // Ce line shown when: (a) drug has full PD (Propofol, Rmz) OR (b) drug has advancedKe0 and
  // the user opted in via the toggle. disabledCe overrides everything — never draw Ce.
  const showCeLine = !disabledCe && (!cpOnlyDefault || (showAdvancedCe && advancedKe0));

  return (
    <div className="glass rounded-xl p-3 border border-slate-200 dark:border-slate-700/60 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-2 mb-1">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {shortName} — {t('sedationMonitor')}
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <ZoomIn className="w-3 h-3 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
            <select
              value={yMode}
              onChange={(e) => setYMode(e.target.value)}
              className="text-[10px] border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="full">{t('yModeFull')}</option>
              <option value="therapeutic">{t('yModeTherapeutic')}</option>
              <option value="custom">{t('yModeCustom')}</option>
            </select>
            <input
              type="range"
              min="1"
              max={sliderMax}
              step="1"
              value={Math.round(Math.sqrt(yMax) * 10)}
              onChange={(e) => {
                const val = Number(e.target.value);
                const newMax = (val / 10) ** 2;
                setYMax(Math.round(newMax * 100) / 100);
                setYMode('custom');
              }}
              className={`w-20 md:w-24 accent-pink-500 ${yMode === 'custom' ? 'opacity-100' : 'opacity-50'}`}
            />
            <span className="text-[10px] font-mono w-16 text-right text-slate-600 dark:text-slate-300 tabular-nums">
              {yMode === 'custom' ? `${yMax} ${displayUnit}` : `${yMaxEffective.toFixed(yMaxEffective < 10 ? 1 : 0)} ${displayUnit}`}
            </span>
          </div>
          {advancedKe0 && (
            <button
              type="button"
              onClick={() => setShowAdvancedCe((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                showAdvancedCe
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/60'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:bg-slate-700'
              }`}
              title={range.advancedKe0Source || ''}
            >
              {showAdvancedCe ? t('sedationCeOn') : t('sedationCeOff')}
            </button>
          )}
          {disabledCe && (
            <button
              type="button"
              disabled
              className="text-[10px] px-2 py-0.5 rounded border bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed"
              title={t(disabledCe.reasonKey)}
            >
              {t('sedationCeUnavailable')}
            </button>
          )}
        </div>
      </div>

      {showAdvancedCe && advancedKe0 && (
        <div className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 mb-1.5">
          {t('sedationAdvancedCeNote', { source: range.advancedKe0Source, ke0: advancedKe0 })}
        </div>
      )}

      <div
        ref={chartAreaRef}
        className={`h-[160px] w-full relative ${clickEnabled ? 'cursor-pointer' : ''}`}
        style={dragEnabled || clickEnabled ? { touchAction: 'pan-y' } : undefined}
        onPointerDown={dragEnabled ? onChartPointerDown : undefined}
        onPointerMove={dragEnabled ? onChartPointerMove : undefined}
        onPointerUp={dragEnabled ? onChartPointerUp : undefined}
        onPointerCancel={dragEnabled ? onChartPointerCancel : undefined}
        onTouchEnd={clickEnabled ? (e) => {
          // Phase 5-H-4: suppress the click that follows a drag release.
          if (Date.now() - dragEndTimeRef.current < SUPPRESS_CLICK_MS) return;
          // iOS Safari fallback — Recharts onClick is unreliable on touch.
          if (popover.open) return;
          if (!e.changedTouches || e.changedTouches.length === 0) return;
          const tch = e.changedTouches[0];
          const rect = chartAreaRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = tch.clientX - rect.left;
          const y = tch.clientY - rect.top;
          // Plot area for the mini chart: left YAxis ~60, right burden-spacer 40 + 10 margin.
          const PLOT_LEFT = 60;
          const PLOT_RIGHT_OFFSET = 50;
          if (x < PLOT_LEFT || x > rect.width - PLOT_RIGHT_OFFSET) return;
          const xRatio = (x - PLOT_LEFT) / (rect.width - PLOT_LEFT - PLOT_RIGHT_OFFSET);
          const minute = Math.max(0, Math.min(simDuration, Math.round(xRatio * simDuration)));
          const nearbyEvent = findEventNearMinute(minute);
          setPopover({ open: true, x, y, minute, editingEventId: nearbyEvent?.id ?? null });
        } : undefined}
      >
        {/* Phase 5-J-1: peak-exceeds indicator for the mini chart. */}
        {yAxisInfo.dataPeak > yMaxEffective && yAxisInfo.dataPeak > 0 && (
          <div className="absolute top-1 left-16 z-10 text-[9px] font-mono bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded px-1 py-0 pointer-events-none">
            {t('peakExceedsRange', { value: yAxisInfo.dataPeak.toFixed(1), unit: displayUnit, time: yAxisInfo.peakTime })}
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displaySim}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            onClick={clickEnabled ? (e) => {
              // Phase 5-H-4: suppress the click that follows a drag release.
              if (Date.now() - dragEndTimeRef.current < SUPPRESS_CLICK_MS) return;
              if (e && e.activeLabel != null && e.chartX != null && e.chartY != null) {
                const minute = Math.max(0, Math.round(Number(e.activeLabel)));
                const nearbyEvent = findEventNearMinute(minute);
                setPopover({
                  open: true,
                  x: e.chartX,
                  y: e.chartY,
                  minute,
                  editingEventId: nearbyEvent?.id ?? null,
                });
              }
            } : undefined}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors?.gridStroke || '#f1f5f9'} />
            <XAxis
              dataKey="time"
              type="number"
              domain={[0, simDuration]}
              tickCount={10}
              allowDataOverflow
              tickFormatter={(val) => isClockMode ? minutesToTime(val, startTime) : val}
              fontSize={10}
              stroke={chartColors?.axisStroke}
            />
            <YAxis
              yAxisId="left"
              domain={[0, yMaxEffective]}
              allowDataOverflow={true}
              label={{ value: `Conc (${displayUnit})`, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: chartColors?.axisStroke } }}
              fontSize={10}
              stroke={chartColors?.axisStroke}
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

            {/* Experimental reference line (Ketamine heat-pain anchor). Drawn as a thin dashed
                line, NOT a band, to communicate this is an experimental analgesia anchor and
                not a sedation/anesthesia threshold. */}
            {range.experimentalReferenceLine && (
              <ReferenceLine
                yAxisId="left"
                y={range.experimentalReferenceLine.value}
                stroke="#64748b"
                strokeDasharray="3 3"
                strokeWidth={1}
                ifOverflow="hidden"
              >
                <Label
                  value={t(range.experimentalReferenceLine.labelKey)}
                  position="insideTopRight"
                  fill="#64748b"
                  fontSize={9}
                  offset={4}
                />
              </ReferenceLine>
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

        {clickEnabled && popover.open && (
          <ChartEventPopover
            open
            onClose={() => setPopover((p) => ({ ...p, open: false }))}
            position={{ x: popover.x, y: popover.y }}
            containerSize={{
              w: chartAreaRef.current?.clientWidth || 0,
              h: chartAreaRef.current?.clientHeight || 0,
            }}
            initialMinute={popover.minute}
            initialDrug={drug}
            drugList={drugList}
            drugUnits={drugUnits}
            drugShortNames={drugShortNames}
            clinicalDefaults={clinicalDefaults}
            lastDoseByDrug={lastDoseByDrug}
            isClockMode={isClockMode}
            startTime={startTime}
            quickAddBolus={quickAddBolus}
            quickAddInfusion={quickAddInfusion}
            editingEvent={popover.editingEventId
              ? events.find((ev) => ev.id === popover.editingEventId)
              : null}
            onUpdate={onUpdate}
            onDelete={onDelete}
            t={t}
          />
        )}
      </div>

      {range.contextWarningKey && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 italic mt-1.5 leading-tight">
          {t(range.contextWarningKey)}
        </p>
      )}
    </div>
  );
}
