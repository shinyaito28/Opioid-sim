import { useMemo,useState } from 'react';
import { LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,ReferenceLine,ReferenceArea } from 'recharts';
import { clockParts } from '../lib/simpleInput.js';
import { graphContext,graphDisplayRange } from '../lib/graphContext.js';
import { DRUG_DISPLAY,DRUG_COLORS,AVAILABLE_MODELS } from '../lib/drugs.js';
import {concentrationBand,suggestedYAxisMax,yAxisSlider,yAxisFromSlider} from '../lib/graphScale.js';
import {doseMarkers,eventDescription,markerClock} from '../lib/doseMarkers.js';
import DoseMarkerValues from './DoseMarkerValues';

export default function SimpleGraph({data,drug,startTime,currentMinute,range,onRange,showRanges,thresholds,savedTraces,
  events,model,modelChoice,onModelChoice,patient,onSelectEvent,children,t}) {
  const display=DRUG_DISPLAY[drug]||{unit:'ng/mL',divisor:1},divisor=display.divisor||1,colors=DRUG_COLORS[drug];
  const clock=value=>{const p=clockParts(value,startTime);return p.hour+':'+p.minute;};
  const displayRange=graphDisplayRange(range);
  const context=graphContext({range:displayRange,startTime,currentMinute,events,drug});
  const chartData=useMemo(()=>data.map(p=>({...p,cp:p.cp/divisor,ce:p.ce==null?null:p.ce/divisor})),[data,divisor]);
  const band=concentrationBand(drug,thresholds,divisor);
  const automaticMax=useMemo(()=>suggestedYAxisMax([...chartData,...savedTraces.flatMap(trace=>trace.data.map(p=>({ce:p.ce==null?null:p.ce/divisor})))],
    showRanges?band:null),[chartData,savedTraces,divisor,showRanges,band?.upper]);
  const [axisMax,setAxisMax]=useState(null),upper=axisMax??automaticMax,slider=yAxisSlider(automaticMax,axisMax);
  const clipped=axisMax!==null&&chartData.some(p=>p.time>=displayRange.start&&p.time<=displayRange.end&&(p.cp>upper||p.ce>upper));
  const [chartWidth,setChartWidth]=useState(600),[selectedMarker,setSelectedMarker]=useState(null);
  const markers=doseMarkers(events,drug,displayRange,Math.max(100,chartWidth-64),currentMinute);
  const selected=markers.find(group=>group.events.some(event=>event.id===selectedMarker));
  const markerX=time=>48+(time-displayRange.start)/(displayRange.end-displayRange.start)*Math.max(0,chartWidth-64);
  const selectMarker=group=>{setSelectedMarker(group.events[0].id);const source=events.find(event=>event.id===group.events[0].sourceId);if(source)onSelectEvent?.(source);};
  return <section className="graph-panel" data-testid="simple-graph">
    <div className="graph-heading"><h2><span className="curve-legend"><i style={{borderColor:colors.cp}}/>Cp</span>
      <span className="curve-legend"><i style={{borderColor:colors.ce}}/>Ce</span></h2><span className="muted">{display.unit}</span></div>
    <div className="graph-model">
      <label>{t('model')} <select aria-label={t('model')} data-testid="graph-model" value={modelChoice} onChange={e=>onModelChoice(e.target.value)}>
        <option value="auto">{t('graphAuto')}</option>
        {AVAILABLE_MODELS[drug].map(value=><option key={value} value={value}>{value}</option>)}
      </select></label>
      <span className="graph-used-model" data-testid="graph-used-model">{t('graphUsingModel',{model})}</span>
    </div>
    {clipped&&<p className="graph-axis-note">{t('graphYClipped',{upper:axisMax,unit:display.unit})}</p>}
    {showRanges&&band&&<p className="graph-band-note" data-testid="graph-band-note"><i aria-hidden="true"/>{t(band.labelKey,{lower:band.lower,upper:band.upper,unit:display.unit})}</p>}
    <div className="graph-context" data-testid="graph-time-context">
      <p className="graph-view">{t('graphView')}: <strong>{context.start}–{context.end}</strong>
        <span> · {t('graphSpan',{minutes:Number(context.spanMinutes.toFixed(2))})}</span></p>
      <p>{t('now')}: {context.now} · {t('graphFirstDose')}: {context.firstDose??'—'}</p>
      <p className="graph-reference" title={t('graphReferenceHelp')}>{t('graphReference')}: {context.reference}</p>
    </div>
    <div className="graph-canvas"><ResponsiveContainer width="100%" height="100%" onResize={width=>setChartWidth(width)}>
      <LineChart data={chartData} margin={{top:12,right:16,bottom:6,left:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1"/>
        <XAxis dataKey="time" type="number" domain={[displayRange.start,displayRange.end]} allowDataOverflow tickFormatter={clock} tick={{fontSize:12}}/>
        <YAxis domain={[0,upper]} allowDataOverflow tick={{fontSize:12}} width={48}/>
        <Tooltip labelFormatter={value=>{const p=clockParts(value,startTime);return clock(value)+(p.day?' ('+(p.day>0?'+':'')+p.day+'d)':'');}}
          formatter={(value,name,item)=>{
            // At an instantaneous jump the tooltip reports the post-dose value.
            if(item?.payload?.edge==='before'&&(name==='Cp'||name==='Ce')){
              const after=chartData.findLast(point=>point.time===item.payload.time);
              if(after)value=after[name==='Cp'?'cp':'ce'];
            }
            return [value==null?'—':Number(value).toFixed(3)+' '+display.unit,name];
          }}/>
        {showRanges&&band&&<ReferenceArea y1={band.lower} y2={band.upper} ifOverflow="hidden" fill="#10b981" fillOpacity={0.09}/>}
        <Line type="linear" dataKey="cp" name="Cp" stroke={colors.cp} strokeWidth={2} dot={false} isAnimationActive={false}/>
        <Line type="linear" dataKey="ce" name="Ce" stroke={colors.ce} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false}/>
        {savedTraces.map(trace=><Line key={trace.id} data={trace.data.map(p=>({...p,cp:p.cp/divisor,ce:p.ce==null?null:p.ce/divisor}))}
          type="linear" dataKey="ce" name={trace.name} stroke={trace.color} strokeDasharray="5 3" dot={false} isAnimationActive={false}/>)}
        {currentMinute>=displayRange.start&&currentMinute<=displayRange.end&&<ReferenceLine x={currentMinute} stroke="#64748b" strokeDasharray="4 4"
          label={{value:t('now'),position:'insideTopRight',fontSize:11,fill:'#64748b'}}/>}
      </LineChart>
    </ResponsiveContainer></div>
    {!!markers.length&&<div className="dose-marker-lane" data-testid="dose-marker-lane">
      <svg viewBox={'0 0 '+chartWidth+' 44'} width="100%" height="44" role="group" aria-label={t('markerLane')}>
        <line x1="48" x2={Math.max(48,chartWidth-16)} y1="2" y2="2" stroke="#cbd5e1"/>
        {markers.map((group,index)=><g key={group.id} className={'dose-marker '+(group.future?'future-marker':'')} data-marker-time={group.time}
          tabIndex="0" role="button" aria-label={group.events.map(event=>markerClock(event.time,startTime)+' '+eventDescription(event,events,patient?.weight??1,t)).join('; ')}
          onClick={()=>selectMarker(group)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectMarker(group);}}}>
          <title>{group.events.map(event=>markerClock(event.time,startTime)+' '+eventDescription(event,events,patient?.weight??1,t)).join('\n')}</title>
          <rect x={markerX(group.time)-22} y="0" width="44" height="44" fill="transparent"/>
          {group.times.map(time=><line key={time} x1={markerX(time)} x2={markerX(time)} y1="0" y2="7" stroke="#64748b"/>)}
          <path d={'M'+(markerX(group.time)-5)+',12 L'+(markerX(group.time)+5)+',12 L'+markerX(group.time)+',20 Z'}
            fill={group.future?'none':'#64748b'} stroke="#64748b"/>
          {group.events.length>1&&<text x={markerX(group.time)+8} y="21" fontSize="10" fill="#64748b">×{group.events.length}</text>}
          <text x={markerX(group.time)} y="36" textAnchor="middle" fontSize="10" fill="#64748b">{'#'+(index+1)}</text>
        </g>)}
      </svg>
      <DoseMarkerValues groups={markers} events={events} weight={patient?.weight??1} startTime={startTime} color={colors.ce} t={t}/>
      <p className="marker-help">{t('markerHint')}</p>
      {selected&&<div className="marker-inspector" aria-live="polite">{selected.events.map(event=><button type="button" className="marker-detail" key={event.id}
        onClick={()=>{const source=events.find(item=>item.id===event.sourceId);if(source)onSelectEvent?.(source);}}>
        <strong>{markerClock(event.time,startTime)}</strong> {eventDescription(event,events,patient?.weight??1,t)}
        <small>{t(event.time>currentMinute?'markerFuture':'markerEarlier')}</small>
      </button>)}</div>}
    </div>}
    {children}
    <div className="axis-controls">
    <div className="graph-range graph-y-controls" data-testid="graph-y-controls">
      <label className="range-bar"><span className="field-label">{t('graphYAxis')} <output data-testid="graph-y-limit">{Number(upper.toPrecision(3))} {display.unit}</output></span>
        <input type="range" aria-label={t('graphYAxis')} aria-valuetext={Number(upper.toPrecision(3))+' '+display.unit}
          min={slider.min} max={slider.max} step="any" value={slider.value} onChange={e=>{
            const value=yAxisFromSlider(e.target.value,slider);if(value!==null)setAxisMax(value);
          }}/>
      </label>
      <button type="button" className="quiet-button" aria-pressed={axisMax===null} onClick={()=>setAxisMax(null)}>{t('graphAuto')}</button>
    </div>
    <div className="graph-range">
      <label className="range-bar"><span className="field-label">{t('simpleRange')}</span>
        <input type="range" aria-label={t('simpleRange')} min={Math.sqrt(30)} max={Math.sqrt(1440)} step="0.1"
          value={Math.sqrt(Math.max(30,range.end))} onChange={e=>{
            const end=Math.max(30,Math.min(1440,Math.round(Number(e.target.value)**2/10)*10));
            onRange({start:Math.min(range.start,end-1),end});
          }}/>
      </label>
    </div>
    <details className="range-details"><summary>{t('simpleExactRange')}</summary>
      <div className="range-numbers">
        <label>{t('xAxisMin')} <input type="number" aria-label={t('xAxisMin')} value={range.start} min={-1440} max={range.end-1}
          onChange={e=>{if(e.target.value!==''&&Number.isFinite(Number(e.target.value))&&Number(e.target.value)>=-1440&&Number(e.target.value)<range.end)onRange({...range,start:Number(e.target.value)});}}/></label>
        <label>{t('xAxisMax')} <input type="number" aria-label={t('xAxisMax')} value={range.end} min={1} max={1440}
          onChange={e=>{if(e.target.value!==''&&Number(e.target.value)>Math.max(0,range.start)&&Number(e.target.value)<=1440)onRange({...range,end:Number(e.target.value)});}}/></label>
      </div>
    </details>
    </div>
  </section>;
}
