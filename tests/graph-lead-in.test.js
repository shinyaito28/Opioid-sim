import test from 'node:test';
import assert from 'node:assert/strict';
import {graphDisplayRange,graphSampleStart,graphContext} from '../src/lib/graphContext.js';
import {getPKParameters} from '../src/lib/drugs.js';
import {processEvents,simulateConcentration} from '../src/lib/solver.js';

const patient={age:35,weight:70,height:175,gender:'male'};
const params=getPKParameters('Fentanyl','Shafer (Adult)',patient);
const bolus=time=>({id:'b',type:'bolus',drug:'Fentanyl',amount:100,time});
const calculate=(range,events)=>simulateConcentration(processEvents(events,range.end),params,range.end,'Fentanyl',graphSampleStart(range,events));

test('lead-in changes only the view: default five minutes, proportionally less at close zoom',()=>{
  for(const [range,expected] of [[{start:0,end:120},-5],[{start:0,end:30},-1.5],
    [{start:29,end:30},28.95],[{start:-10,end:120},-15],[{start:0,end:1440},-5]]) {
    const before=structuredClone(range),display=graphDisplayRange(range);
    assert.equal(display.start,expected);assert.equal(display.end,range.end);assert.deepEqual(range,before);
    assert(display.start<range.start);assert(range.start-display.start<=5);
  }
});

test('negative display bounds survive midnight and respect the supported earliest boundary',()=>{
  const range={start:0,end:120},display=graphDisplayRange(range);
  const context=graphContext({range:display,startTime:'00:02',currentMinute:0,events:[bolus(0)],drug:'Fentanyl'});
  assert.equal(context.start,'23:57 (-1d)');assert.equal(context.reference,'00:02');
  assert.equal(context.firstDose,'00:02');assert.equal(context.spanMinutes,125);
  assert.deepEqual(graphDisplayRange({start:-1440,end:120}),{start:-1440,end:120});
  assert.equal(graphDisplayRange({start:-1439,end:120}).start,-1440);
  const events=[bolus(-1440)],data=calculate({start:-1440,end:1},events);
  assert.equal(data[0].time,-1440);assert(data[0].cp>0);assert(data.every(p=>Number.isFinite(p.cp)));
});

test('lead-in samples show a true pre-dose baseline and preserve every existing nonnegative sample',()=>{
  const range={start:0,end:120},events=[bolus(0)],data=calculate(range,events);
  assert.equal(data[0].time,-5);
  assert(data.filter(p=>p.time<0).every(p=>p.cp===0&&p.ce===0));
  assert(data.find(p=>p.time===0).cp>0);
  assert.deepEqual(data.filter(p=>p.time>=0),simulateConcentration(processEvents(events,120),params,120,'Fentanyl'));
  const close=calculate({start:0,end:30},events);
  assert.equal(close[0].time,-1.5);assert.equal(close[0].cp,0);
});

test('past boluses and saved ongoing infusions retain actual residual concentrations in the margin',()=>{
  const fixtures=[[bolus(-60)],[{id:'i',type:'infusion',drug:'Fentanyl',time:-60,rate:100,isInfinite:true,duration:0}]];
  for(const events of fixtures) {
    const saved={plotStart:0,simDuration:120,events,savedTraces:[{data:[{time:0,cp:2,ce:1}]}]};
    const original=structuredClone(saved),range={start:saved.plotStart,end:saved.simDuration};
    const data=calculate(range,saved.events),atMargin=data.find(p=>p.time===-5);
    assert(atMargin.cp>0);assert(atMargin.ce>0);
    const previous=simulateConcentration(processEvents(events,120),params,120,'Fentanyl',-60);
    assert.deepEqual(data,previous);assert.deepEqual(saved,original);
  }
});

test('manual positive and negative zooms keep dose times and the established calculation unchanged',()=>{
  const events=[bolus(-10)],original=structuredClone(events);
  const baseline=simulateConcentration(processEvents(events,120),params,120,'Fentanyl',-10);
  for(const range of [{start:-10,end:120},{start:-2,end:30},{start:20,end:30}]) {
    const data=calculate(range,events);
    for(const point of baseline.filter(p=>p.time<=range.end))assert.deepEqual(data.find(p=>p.time===point.time),point);
    assert.deepEqual(events,original);
  }
});
