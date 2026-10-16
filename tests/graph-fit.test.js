import test from 'node:test';
import assert from 'node:assert/strict';
import {fitGraphRange,xAxisSlider,xAxisFromSlider} from '../src/lib/graphFit.js';
import {graphDisplayRange,graphSampleStart,graphContext} from '../src/lib/graphContext.js';
import {createUndoHistory} from '../src/lib/undo.js';
import {validateSimpleSnapshot,writeSimpleStorage,readSimpleStorage} from '../src/lib/simpleStorage.js';
import {CALCULATION_VERSION} from '../src/lib/state.js';
import {getPKParameters} from '../src/lib/drugs.js';
import {processEvents,simulateConcentration} from '../src/lib/solver.js';
const bolus=(id,time,drug='Fentanyl')=>({id,type:'bolus',drug,time,amount:50});
const infusion=(id,time,rate=70,duration=60,isInfinite=true)=>({id,type:'infusion',drug:'Fentanyl',time,rate,duration,isInfinite,originalUnit:'mcg/hr'});
const patient={age:35,weight:70,height:175,gender:'male'};
const snapshot=events=>({schemaVersion:5,calculationVersion:CALCULATION_VERSION,patient,drug:'Fentanyl',modelByDrug:{},events,
  simDuration:180,plotStart:0,manualRange:false,therapeuticOverrides:{},savedTraces:[],savedScenarios:[],
  simSettings:{startTime:'08:00',clockStartDate:'2026-10-16'},entryMinute:120});

test('after deleting 08:00, fit shows 08:55 before the remaining 09:00 and 10:00 doses',()=>{
  const events=[bolus('eight',0),bolus('nine',60),bolus('ten',120)],remaining=events.slice(1);
  const fitted=fitGraphRange(remaining,'Fentanyl');assert.deepEqual(fitted,{start:60,end:180});
  const context=graphContext({range:graphDisplayRange(fitted),startTime:'08:00',currentMinute:120,events:remaining,drug:'Fentanyl'});
  assert.equal(context.start,'08:55');assert.equal(context.end,'11:00');assert.equal(context.reference,'08:00');
  assert.equal(context.firstDose,'09:00');assert.deepEqual(events.map(e=>e.time),[0,60,120]);
});

test('fit uses edited records when requested and can be undone separately from deletion/editing',()=>{
  const original=snapshot([bolus('early',0),bolus('late',120)]),history=createUndoHistory(original);
  const removed={...original,events:original.events.slice(1)};history.update(removed);
  const range=fitGraphRange(removed.events,'Fentanyl'),fitted={...removed,plotStart:range.start,simDuration:range.end,manualRange:true};history.update(fitted);
  assert.equal(history.undo().plotStart,0);assert.deepEqual(history.current.events,removed.events);
  assert.deepEqual(history.undo(),original);history.redo();assert.deepEqual(history.redo(),fitted);
  const moved=removed.events.map(e=>({...e,time:150}));assert.deepEqual(fitGraphRange(moved,'Fentanyl'),{start:150,end:270});
});

test('fit concerns the displayed drug; empty records use the default view and stop-only records remain visible',()=>{
  assert.deepEqual(fitGraphRange([bolus('other',0,'Morphine'),bolus('visible',60)],'Fentanyl'),{start:60,end:180});
  assert.deepEqual(fitGraphRange([],'Fentanyl'),{start:0,end:120});
  assert.deepEqual(fitGraphRange([bolus('other',60,'Morphine')],'Fentanyl'),{start:0,end:120});
  assert.deepEqual(fitGraphRange([infusion('stop',60,0)],'Fentanyl'),{start:60,end:180});
});

test('fit includes finite infusion ends, rate changes, stops and a useful forecast for ongoing infusions',()=>{
  assert.deepEqual(fitGraphRange([infusion('finite',60,70,180,false)],'Fentanyl'),{start:60,end:300});
  assert.deepEqual(fitGraphRange([infusion('ongoing',60)],'Fentanyl'),{start:60,end:180});
  const events=[infusion('start',60,70,180,false),infusion('stop',240,0)];
  assert.deepEqual(fitGraphRange(events,'Fentanyl'),{start:60,end:300});
});

test('fit keeps the case clock and day offsets across midnight and in the preceding day',()=>{
  const events=[bolus('one',120),bolus('two',180)],range=fitGraphRange(events,'Fentanyl');
  const context=graphContext({range:graphDisplayRange(range),startTime:'23:00',currentMinute:150,events,drug:'Fentanyl'});
  assert.equal(context.start,'00:55 (+1d)');assert.equal(context.firstDose,'01:00 (+1d)');assert.equal(context.reference,'23:00');
  const past=fitGraphRange([bolus('past',-60)],'Fentanyl');
  assert.equal(graphContext({range:graphDisplayRange(past),startTime:'00:05',currentMinute:0,events:[],drug:'Fentanyl'}).start,'23:00 (-1d)');
});

test('X slider zooms from a fitted anchor instead of bringing the deleted case-start margin back',()=>{
  const slider=xAxisSlider({start:60,end:180});
  assert.deepEqual(xAxisFromSlider(String(Math.sqrt(30)),slider),{start:60,end:90});
  assert.deepEqual(xAxisFromSlider(String(Math.sqrt(60)),slider),{start:60,end:120});
  assert.deepEqual(xAxisFromSlider(String(slider.max),slider),{start:60,end:1440});
  assert.deepEqual(xAxisFromSlider(String(Math.sqrt(120)),xAxisSlider({start:0,end:120})),{start:0,end:120});
  for(const value of ['',NaN,Infinity,'invalid'])assert.equal(xAxisFromSlider(value,slider),null);
});

test('fit and slider respect both supported boundaries and very short manual windows',()=>{
  for(const events of [[bolus('earliest',-1440)],[bolus('latest',1440)],[infusion('end',1430,70,100,false)]]){
    const range=fitGraphRange(events,'Fentanyl');assert(range.start>=-1440&&range.start<range.end&&range.end>=1&&range.end<=1440);
    const slider=xAxisSlider(range);for(const value of [slider.min,slider.max]){const zoom=xAxisFromSlider(String(value),slider);assert.equal(zoom.start,range.start);assert(zoom.end>zoom.start&&zoom.end>=1&&zoom.end<=1440);}
  }
  const short={start:60.5,end:61};assert.deepEqual(xAxisFromSlider(String(xAxisSlider(short).min),xAxisSlider(short)),short);
  assert.deepEqual(xAxisFromSlider(String(xAxisSlider({start:-120,end:1}).min),xAxisSlider({start:-120,end:1})),{start:-120,end:1});
});

test('fitted ranges reload through existing storage without altering events, clock, traces or named cases',()=>{
  const current=snapshot([bolus('nine',60),bolus('ten',120)]);current.savedScenarios=[{id:'named',name:'Synthetic original',data:snapshot([bolus('eight',0)])}];
  current.savedTraces=[{id:'trace',name:'Synthetic trace',drug:'Fentanyl',color:'#000',data:[]}];
  const before=structuredClone(current),range=fitGraphRange(current.events,current.drug);
  const fitted=validateSimpleSnapshot({...current,plotStart:range.start,simDuration:range.end,manualRange:true});
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  writeSimpleStorage(storage,fitted);const restored=readSimpleStorage(storage).data;
  assert.equal(restored.plotStart,60);assert.equal(restored.manualRange,true);
  for(const key of ['events','simSettings','savedTraces','savedScenarios'])assert.deepEqual(restored[key],before[key]);
  assert.deepEqual(current,before);
});

test('fitting the view preserves Cp/Ce at common sample times, including historical residuals',()=>{
  const params=getPKParameters('Fentanyl','Shafer (Adult)',patient);
  for(const events of [[bolus('nine',60),bolus('ten',120)],[infusion('start',60),infusion('stop',120,0)],
    [bolus('past',-60.25),bolus('later',30)],[bolus('boundary',-1439.25)]]){
    const before=structuredClone(events),oldRange={start:0,end:300},newRange=fitGraphRange(events,'Fentanyl');
    const simulate=range=>simulateConcentration(processEvents(events,range.end),params,range.end,'Fentanyl',graphSampleStart(range,events),true);
    const baseline=simulate(oldRange),fitted=simulate(newRange);
    for(const point of fitted.filter(p=>p.time>=0&&p.time<=Math.min(oldRange.end,newRange.end))){
      const matches=baseline.filter(p=>p.time===point.time);assert(matches.some(other=>Math.abs(other.cp-point.cp)<1e-10&&Math.abs((other.ce??0)-(point.ce??0))<1e-10),'sample '+point.time);
    }
    assert.deepEqual(events,before);
  }
});
