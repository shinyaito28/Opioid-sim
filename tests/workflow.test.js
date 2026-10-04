import test from 'node:test';
import assert from 'node:assert/strict';
import {startInfusion,applyInfusionAction,infusionGroups,activeInfusion,classifyEntry,eventsForCalculation,formatEntryTime,eventStatus} from '../src/lib/workflow.js';
import {simulateConcentration as solve,processEvents} from '../src/lib/solver.js';
import {validateSnapshot} from '../src/lib/state.js';
import {summarize} from '../src/lib/metrics.js';
const infusion=(id,time=0,rate=60,status='administered')=>({id,drug:'Fentanyl',type:'infusion',time,rate,duration:60,isInfinite:true,entryStatus:status});
const params={V1:10,V2:0,V3:0,Cl:1,Q2:0,Q3:0,ke0:.2};
const simulateConcentration=(events,p,d,drug)=>solve(processEvents(events,d),p,d,drug);
test('new pump labels remain distinct after deletion and adoption of legacy records',()=>{
 let events=startInfusion([],infusion('a'));events=startInfusion(events,infusion('b'),true);
 events=events.filter(e=>e.id!=='a');events=startInfusion(events,infusion('c'),true);
 assert.deepEqual(infusionGroups(events).map(g=>g.label),['#2','#3']);
 const legacy=[{...infusion('old-a'),entryStatus:undefined},{...infusion('old-b'),entryStatus:undefined}];
 const adopted=applyInfusionAction(legacy,'old-a','change',infusion('new',0));
 const labels=infusionGroups(adopted).map(g=>g.label);assert.equal(new Set(labels).size,labels.length);
 assert(adopted.some(e=>e.id==='old-b' && e.seriesLabel===undefined));
});
test('new starts require explicit parallel intent and retain separate controllable series',()=>{
 const first=startInfusion([],infusion('a'));assert.equal(infusionGroups(first).length,1);
 assert.throws(()=>startInfusion(first,infusion('b')),e=>e.code==='AMBIGUOUS_INFUSION');
 const both=startInfusion(first,infusion('b'),true);
 assert.equal(infusionGroups(both).length,2);assert.notEqual(both[0].seriesId,both[1].seriesId);
 const changed=applyInfusionAction(both,'b','change',infusion('c',10,120));
 assert.equal(changed.find(e=>e.id==='a').isInfinite,true);assert.equal(changed.find(e=>e.id==='b').duration,10);
});
test('selected unmarked legacy pump is adopted without touching another legacy pump',()=>{
 const legacy=[{...infusion('a'),entryStatus:undefined},{...infusion('b'),entryStatus:undefined,parallel:true}];
 const result=applyInfusionAction(legacy,'a','change',infusion('c',10,120));
 assert.deepEqual(result.find(e=>e.id==='b'),legacy[1]);assert.equal(result.find(e=>e.id==='a').duration,10);
 const changedB=applyInfusionAction(result,'b','stop',infusion('d',15));
 assert.equal(changedB.find(e=>e.id==='c').isInfinite,true);
 assert.equal(changedB.find(e=>e.id==='b').duration,15);assert.equal(changedB.find(e=>e.id==='d').rate,0);
});
test('stop and restart affect only their pump and integrate no dose during the stop',()=>{
 let events=startInfusion([],infusion('a'));events=startInfusion(events,infusion('parallel',0,30),true);
 events=applyInfusionAction(events,'a','stop',infusion('stop',10));
 events=applyInfusionAction(events,'a','restart',infusion('restart',20,120));
 const group=infusionGroups(events).find(g=>g.first.id==='a');
 assert.equal(activeInfusion(group,5).rate,60);assert.equal(activeInfusion(group,15).rate,0);assert.equal(activeInfusion(group,25).rate,120);
 assert.equal(events.find(e=>e.id==='parallel').isInfinite,true);
 const m=summarize(simulateConcentration(events,params,30,'Fentanyl'),events,'Fentanyl',30,{analgesiaMin:1e6},{divisor:1,unit:'ng/mL'},'mcg');
 assert.equal(m.totalDose,45);
});
test('excluding planned changes restores the preceding entered stop and does not alter saved records',()=>{
 let events=startInfusion([],infusion('a'));
 events=applyInfusionAction(events,'a','stop',infusion('plan-stop',10,0,'planned'));
 const before=JSON.stringify(events);const scoped=eventsForCalculation(events,false);
 assert.equal(scoped.length,1);assert.equal(scoped[0].isInfinite,true);
 const all=simulateConcentration(events,params,30,'Fentanyl');const actual=simulateConcentration(scoped,params,30,'Fentanyl');
 assert(actual.at(-1).cp>all.at(-1).cp);assert.equal(JSON.stringify(events),before);
 const plannedBolus={id:'plan-bolus',drug:'Fentanyl',type:'bolus',time:5,amount:100,entryStatus:'planned'};
 assert.equal(eventsForCalculation([...events,plannedBolus],false).length,1);
});
test('future administered entries are rejected and elapsed plans never become actual automatically',()=>{
 assert.throws(()=>classifyEntry(infusion('a',10),'administered',0),e=>e.code==='FUTURE_ADMINISTERED');
 const plan=classifyEntry(infusion('a',10),'planned',0);
 assert.equal(eventStatus(plan),'planned');assert.equal(classifyEntry(plan,'administered',10).entryStatus,'administered');
 assert.equal(eventStatus({type:'bolus'}),'unclassified');
});
test('stale drafts and times before the pump start cannot mutate history',()=>{
 const events=startInfusion([],infusion('a',5));const revision=JSON.stringify(infusionGroups(events)[0].records);
 assert.throws(()=>applyInfusionAction(events,'a','change',infusion('b',4)),RangeError);
 const changed=applyInfusionAction(events,'a','change',infusion('b',10));
 assert.throws(()=>applyInfusionAction(changed,'a','stop',infusion('c',15),revision),e=>e.code==='DRAFT_STALE');
 assert.equal(events.length,1);assert.equal(events[0].isInfinite,true);
});
test('midnight labels retain day offsets and exact relative minutes',()=>{
 assert.equal(formatEntryTime(70,true,'23:00'),'+1d 00:10 · 70 min');
 assert.equal(formatEntryTime(-5,true,'00:00'),'-1d 23:55 · -5 min');
 assert.equal(formatEntryTime(.5,false),'.5 min'.replace('.5','0.5'));
});
test('schema 4 round-trips plans and pump metadata; older history stays unclassified',()=>{
 const patient={age:35,weight:70,height:170,gender:'male'};
 const data={schemaVersion:4,patient,drug:'Fentanyl',events:startInfusion([],infusion('a',10,60,'planned')),simDuration:120,entryReferenceTime:5,includePlanned:false};
 const restored=validateSnapshot(JSON.parse(JSON.stringify(data)));assert.equal(restored.events[0].entryStatus,'planned');assert.equal(restored.includePlanned,false);assert.equal(restored.entryReferenceTime,5);
 const old=validateSnapshot({schemaVersion:3,patient,drug:'Fentanyl',events:[{...infusion(1),entryStatus:undefined}],simDuration:120});
 assert.equal(old.events[0].entryStatus,undefined);
 assert.throws(()=>validateSnapshot({...data,entryReferenceTime:-1}));assert.throws(()=>validateSnapshot({...data,events:[{...data.events[0],entryStatus:'actual'}]}));
});
test('an explicit zero-rate stop is not treated as an ongoing positive infusion in summaries',()=>{
 let events=startInfusion([],infusion('a'));events=applyInfusionAction(events,'a','stop',infusion('stop',10));
 const data=simulateConcentration(events,params,30,'Fentanyl');
 const m=summarize(data,events,'Fentanyl',30,{analgesiaMin:1e6},{divisor:1,unit:'ng/mL'},'mcg');
 assert.equal(m.recoveryTime,0);assert.equal(m.totalDose,10);
});
