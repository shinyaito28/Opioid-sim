import { LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,ReferenceLine,ReferenceArea } from 'recharts';
import { clockParts } from '../lib/simpleInput.js';
import { graphContext,graphDisplayRange } from '../lib/graphContext.js';
import { DRUG_DISPLAY,DRUG_COLORS,AVAILABLE_MODELS } from '../lib/drugs.js';

export default function SimpleGraph({data,drug,startTime,currentMinute,range,onRange,showRanges,thresholds,savedTraces,
  events,model,modelChoice,onModelChoice,t}) {
  const display=DRUG_DISPLAY[drug]||{unit:'ng/mL',divisor:1},divisor=display.divisor||1,colors=DRUG_COLORS[drug];
  const clock=value=>{const p=clockParts(value,startTime);return p.hour+':'+p.minute;};
  const displayRange=graphDisplayRange(range);
  const context=graphContext({range:displayRange,startTime,currentMinute,events,drug});
  const chartData=data.map(p=>({...p,cp:p.cp/divisor,ce:p.ce==null?null:p.ce/divisor}));
  const lower=thresholds?.analgesiaMin??thresholds?.bisTarget?.min,upper=thresholds?.analgesiaMax??thresholds?.bisTarget?.max;
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
    <div className="graph-context" data-testid="graph-time-context">
      <p className="graph-view">{t('graphView')}: <strong>{context.start}–{context.end}</strong>
        <span> · {t('graphSpan',{minutes:Number(context.spanMinutes.toFixed(2))})}</span></p>
      <p>{t('now')}: {context.now} · {t('graphFirstDose')}: {context.firstDose??'—'}</p>
      <p className="graph-reference" title={t('graphReferenceHelp')}>{t('graphReference')}: {context.reference}</p>
    </div>
    <div className="graph-canvas"><ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{top:12,right:16,bottom:6,left:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1"/>
        <XAxis dataKey="time" type="number" domain={[displayRange.start,displayRange.end]} allowDataOverflow tickFormatter={clock} tick={{fontSize:12}}/>
        <YAxis domain={[0,'auto']} tick={{fontSize:12}} width={48}/>
        <Tooltip labelFormatter={value=>{const p=clockParts(value,startTime);return clock(value)+(p.day?' ('+(p.day>0?'+':'')+p.day+'d)':'');}}
          formatter={(value,name)=>[value==null?'—':Number(value).toFixed(3)+' '+display.unit,name]}/>
        {showRanges&&lower!=null&&upper!=null&&<ReferenceArea y1={lower/divisor} y2={upper/divisor} fill="#10b981" fillOpacity={0.09}/>}
        <Line type="linear" dataKey="cp" name="Cp" stroke={colors.cp} strokeWidth={2} dot={false} isAnimationActive={false}/>
        <Line type="linear" dataKey="ce" name="Ce" stroke={colors.ce} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false}/>
        {savedTraces.map(trace=><Line key={trace.id} data={trace.data.map(p=>({...p,cp:p.cp/divisor,ce:p.ce==null?null:p.ce/divisor}))}
          type="linear" dataKey="ce" name={trace.name} stroke={trace.color} strokeDasharray="5 3" dot={false} isAnimationActive={false}/>)}
        {currentMinute>=displayRange.start&&currentMinute<=displayRange.end&&<ReferenceLine x={currentMinute} stroke="#64748b" strokeDasharray="4 4"
          label={{value:t('now'),position:'insideTopRight',fontSize:11,fill:'#64748b'}}/>}
      </LineChart>
    </ResponsiveContainer></div>
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
  </section>;
}
