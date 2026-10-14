import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Curve} from 'recharts';
import {processEvents,simulateConcentration} from '../src/lib/solver.js';
import {clockParts} from '../src/lib/simpleInput.js';

const p={V1:10,V2:0,V3:0,Cl:1,Q2:0,Q3:0,ke0:.2};
const bolus=(id,time,amount=100)=>({id,time,amount,drug:'Fentanyl',type:'bolus'});
const infusion=(id,time,rate=60,duration=10)=>({id,time,rate,duration,isInfinite:false,drug:'Fentanyl',type:'infusion'});
const sim=(events,duration=5,first=-2,edges=true)=>simulateConcentration(processEvents(events,duration),p,duration,'Fentanyl',first,edges);
const close=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const values=({time,cp,ce})=>({time,cp,ce});

test('a bolus has exact same-time before/after Cp, continuous Ce and no pre-dose rise',()=>{
  const data=sim([bolus('b',0)]),pair=data.filter(point=>point.time===0);
  assert.deepEqual(pair,[{time:0,cp:0,ce:0,edge:'before'},{time:0,cp:10,ce:0,edge:'after'}]);
  assert(data.filter(point=>point.time<0).every(point=>point.cp===0&&point.ce===0));
  // Recharts linear interpolation draws the equal-x pair as a vertical segment.
  const path=renderToStaticMarkup(React.createElement(Curve,{type:'linear',points:data.map(point=>({x:(point.time+2)*10,y:100-point.cp*2}))}));
  assert(path.includes('L10,100L20,100L20,80L30,'),path);
});

test('fractional-minute boluses include the instantaneous peak and retain original grid samples',()=>{
  const events=[bolus('b',.25)],data=sim(events),pair=data.filter(point=>point.time===.25);
  assert.equal(pair.length,2);assert.equal(pair[0].cp,0);assert.equal(pair[1].cp,10);assert.equal(pair[0].ce,pair[1].ce);
  for(const old of sim(events,5,-2,false))assert.deepEqual(values(data.findLast(point=>point.time===old.time)),old);
  assert(data.every((point,index)=>index===0||data[index-1].time<=point.time));
});

test('same-time boluses sum, later boluses jump from residual Cp during overlapping infusions',()=>{
  const events=[infusion('i',-1,120),infusion('j',-.5,60),bolus('a',.25),bolus('b',.25,50),bolus('c',2,20)];
  const original=structuredClone(events),data=sim(events);
  for(const [time,jump] of [[.25,15],[2,2]]){
    const pair=data.filter(point=>point.time===time);
    assert.equal(pair.length,2);assert(pair[0].cp>0);close(pair[1].cp-pair[0].cp,jump);assert.equal(pair[0].ce,pair[1].ce);
  }
  for(const old of sim(events,5,-2,false))assert.deepEqual(values(data.findLast(point=>point.time===old.time)),old);
  assert.deepEqual(events,original);
});

test('infusion start and stop sample their continuous state without artificial vertical steps',()=>{
  const data=sim([infusion('i',.25,60,1.5)]);
  assert(!data.some(point=>point.edge));
  assert.deepEqual(data.find(point=>point.time===.25),{time:.25,cp:0,ce:0});
  assert.equal(data.filter(point=>point.time===1.75).length,1);
  assert(data.find(point=>point.time===1.75).cp>0);
});

test('moving doses removes the old jump; negative time and midnight keep the real event time',()=>{
  const original=[bolus('b',-1)],moved=original.map(event=>({...event,time:.25}));
  const before=sim(original),after=sim(moved);
  assert(before.some(point=>point.time===-1&&point.edge==='after'));
  assert(!after.some(point=>point.time===-1&&point.edge));
  assert.equal(after.find(point=>point.time===.25&&point.edge==='after').cp,10);
  assert.deepEqual(clockParts(-1,'00:00'),{hour:'23',minute:'59',day:-1});
  assert.equal(original[0].time,-1);
});

test('event-edge sampling preserves every established sample across independent PK reference cases',()=>{
  const cases=JSON.parse(fs.readFileSync(new URL('./reference-fixtures.json',import.meta.url))).cases;
  for(const fixture of cases){
    const events=processEvents(fixture.events,fixture.duration);
    const standard=simulateConcentration(events,fixture.params,fixture.duration,fixture.drug);
    const chart=simulateConcentration(events,fixture.params,fixture.duration,fixture.drug,0,true);
    for(const old of standard)assert.deepEqual(values(chart.findLast(point=>point.time===old.time)),old);
    for(let index=0;index<chart.length;index++)if(chart[index].edge==='before'){
      assert.equal(chart[index+1].edge,'after');assert.equal(chart[index+1].time,chart[index].time);
      assert.equal(chart[index+1].ce,chart[index].ce);
    }
  }
});
