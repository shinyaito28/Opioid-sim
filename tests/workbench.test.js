import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {doseMarkers,eventDescription,infusionKind,markerClock} from '../src/lib/doseMarkers.js';
import {newCaseWithArchive} from '../src/lib/caseDraft.js';
import {createUndoHistory} from '../src/lib/undo.js';
import {validateSimpleSnapshot,writeSimpleStorage,readSimpleStorage,SIMPLE_KEY} from '../src/lib/simpleStorage.js';
import {DRUG_LIST,getDoseUnitForDrug} from '../src/lib/drugs.js';
import {CALCULATION_VERSION} from '../src/lib/state.js';
const en=JSON.parse(fs.readFileSync(new URL('../src/locales/en.json',import.meta.url)));
const t=(key,options={})=>en[key]??options.defaultValue??key;
const bolus=(id,time,drug='Fentanyl',amount=50)=>({id,time,drug,type:'bolus',amount});
const infusion=(id,time,rate=60,extra={})=>({id,time,drug:'Fentanyl',type:'infusion',rate,originalUnit:'mcg/hr',duration:60,isInfinite:true,uiSingle:true,...extra});
const fresh=()=>({schemaVersion:5,calculationVersion:CALCULATION_VERSION,patient:{age:35,weight:70,height:175,gender:'male'},drug:'Fentanyl',
  modelByDrug:{},events:[],simDuration:120,plotStart:0,manualRange:false,therapeuticOverrides:{},savedTraces:[],savedScenarios:[],
  simSettings:{startTime:'09:00',clockStartDate:'2026-10-16'},entryMinute:0});

test('marker lane filters by drug and range without shifting true coordinates or changing events',()=>{
  const events=[bolus('past',-2),bolus('now',0),bolus('other',4,'Morphine'),bolus('future',45),bolus('outside',121)];
  const before=structuredClone(events),markers=doseMarkers(events,'Fentanyl',{start:-5,end:120},1000,0);
  assert.deepEqual(markers.flatMap(g=>g.events.map(e=>e.id)),['past','now','future']);
  assert.equal(markers.at(-1).future,true);assert.equal(markers[0].future,false);
  assert.deepEqual(markers.flatMap(g=>g.times),[-2,0,45]);assert.deepEqual(events,before);
});

test('same-time and nearby doses form one tap target while retaining every event time and unit',()=>{
  const events=[bolus('a',0),bolus('b',0,'Fentanyl',25),infusion('i',0),bolus('c',1)];
  const [group]=doseMarkers(events,'Fentanyl',{start:0,end:120},300,0);
  assert.equal(group.time,0);assert.equal(group.events.length,4);assert.deepEqual(group.times,[0,1]);
  assert(eventDescription(group.events.find(e=>e.id==='b'),events,70,t).includes('25 mcg'));
  assert(eventDescription(group.events.find(e=>e.id==='i'),events,70,t).includes('60 mcg/hr'));
});

test('infusion start, change, stop and restart are labelled without altering rate meanings',()=>{
  const events=[infusion('start',0),infusion('change',10,120),infusion('stop',20,0),infusion('restart',30,30)];
  assert.deepEqual(events.map(e=>infusionKind(e,events)),['start','change','stop','start']);
  assert.match(eventDescription(events[2],events,70,t),/Stop · 0 mcg\/hr/);
});

test('finite imported infusions get an end marker linked to their original record',()=>{
  const event=infusion('finite',-1,60,{isInfinite:false,duration:6});
  const points=doseMarkers([event],'Fentanyl',{start:-5,end:10},600,0).flatMap(g=>g.events);
  const end=points.find(e=>e.markerKind==='end');assert.equal(end.time,5);assert.equal(end.sourceId,'finite');assert.equal(end.rate,0);
  const explicit=infusion('stop',5,0);
  assert(!doseMarkers([event,explicit],'Fentanyl',{start:-5,end:10},600).flatMap(g=>g.events).some(e=>e.markerKind==='end'));
});

test('markers retain absolute and weight-normalized rate display across all drug dose units',()=>{
  for(const drug of DRUG_LIST)assert(eventDescription(bolus('test',0,drug,2),[],70,t).endsWith('2 '+getDoseUnitForDrug(drug)));
  const event=infusion('weight',0,70,{originalUnit:'mcg/kg/hr'});
  assert.match(eventDescription(event,[event],70,t),/1 mcg\/kg\/hr$/);
  assert.match(eventDescription(event,[event],35,t),/2 mcg\/kg\/hr$/);
  assert.equal(markerClock(-1,'00:00'),'23:59 (-1d)');assert.equal(markerClock(20,'23:50'),'00:10 (+1d)');
});

test('New Case archives the current case, keeps the existing library and traces, and survives reload',()=>{
  const current=fresh();current.events=[bolus('original',0)];
  current.savedScenarios=[{id:'named',name:'Synthetic saved case',data:fresh(),timestamp:1}];
  current.savedTraces=[{id:'trace',name:'Synthetic curve',drug:'Fentanyl',color:'#000',data:[]}];
  const before=structuredClone(current),next=newCaseWithArchive(current,fresh(),{id:'archive',name:'Before New Case',timestamp:2});
  assert.equal(next.events.length,0);assert.equal(next.savedScenarios.length,2);assert.equal(next.savedScenarios[1].id,'named');
  assert.deepEqual(next.savedScenarios[0].data.events,current.events);assert.deepEqual(next.savedTraces,current.savedTraces);assert.deepEqual(current,before);
  const stored=new Map(),storage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
  writeSimpleStorage(storage,next);const restored=readSimpleStorage(storage).data;
  assert.deepEqual(restored.savedScenarios[0].data.events,current.events);assert(stored.has(SIMPLE_KEY));
  assert.doesNotThrow(()=>validateSimpleSnapshot({...restored.savedScenarios[0].data,savedScenarios:restored.savedScenarios,savedTraces:restored.savedTraces}));
});

test('New Case does not overwrite a named case and can be undone/redone as one action',()=>{
  const current=fresh();current.events=[bolus('original',0)];const data=structuredClone(current);delete data.savedScenarios;delete data.savedTraces;
  current.savedScenarios=[{id:'named',name:'Keep this name',data,timestamp:1}];
  const next=newCaseWithArchive(current,fresh(),{id:'unused',name:'Do not replace',timestamp:2});
  assert.equal(next.savedScenarios.length,1);assert.equal(next.savedScenarios[0].name,'Keep this name');
  const history=createUndoHistory(current);history.update(next);assert.deepEqual(history.undo(),current);assert.deepEqual(history.redo(),next);
});
