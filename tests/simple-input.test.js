import test from 'node:test';
import assert from 'node:assert/strict';
import {upsertCondition,deleteCondition,adoptSingle,legacyStreams,decimalInput,clockParts,clockFields,createInfusion,editCondition} from '../src/lib/simpleInput.js';
import {createUndoHistory} from '../src/lib/undo.js';
import {readSimpleStorage,writeSimpleStorage,validateSimpleSnapshot,SIMPLE_KEY,LEGACY_KEY,BACKUP_KEY} from '../src/lib/simpleStorage.js';
import {processEvents,simulateConcentration} from '../src/lib/solver.js';
import {convertToStandardUnit,getPKParameters} from '../src/lib/drugs.js';
import {clockToMinutes} from '../src/lib/clock.js';
import {getBestModel} from '../src/lib/modelSelection.js';

const patient={age:35,weight:70,height:175,gender:'male'};
const rate=(id,time,value=60)=>({id,drug:'Fentanyl',type:'infusion',time,rate:value,originalRate:value,originalUnit:'mcg/hr',duration:60,isInfinite:true,uiSingle:true,seriesId:'single:Fentanyl'});
const bolus=(id,time,amount=100)=>({id,drug:'Fentanyl',type:'bolus',time,amount});
const snapshot=events=>({schemaVersion:4,patient,drug:'Fentanyl',modelByDrug:{},events,simDuration:120,simSettings:{startTime:'23:55',clockStartDate:'2026-10-14'},savedScenarios:[],savedTraces:[]});
const memory=initial=>{const data=new Map(Object.entries(initial||{}));return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),data};};
const p={V1:10,V2:0,V3:0,Cl:0,Q2:0,Q3:0,ke0:0};
const curve=events=>simulateConcentration(processEvents(events,120),p,120,'Fentanyl');

test('same-time bolus and infusion coexist, with exact summed mass',()=>{
  let events=upsertCondition([],bolus('b',0));
  events=upsertCondition(events,rate('r',0));
  assert.equal(events.length,2);assert(Math.abs(curve(events).find(d=>d.time===60).cp-16)<1e-10);
});
test('retrospective rate insertion preserves future changes and stops',()=>{
  let events=[];
  for(const e of [rate('start',0,60),rate('later',60,120),rate('stop',90,0)])events=upsertCondition(events,e);
  events=upsertCondition(events,rate('past',30,30));
  assert.deepEqual(events.filter(e=>e.type==='infusion').sort((a,b)=>a.time-b.time).map(e=>[e.id,e.time,e.duration,e.rate]),[
    ['start',0,30,60],['past',30,30,30],['later',60,30,120],['stop',90,60,0]]);
  assert(Math.abs(curve(events).at(-1).cp-10.5)<1e-10);
});
test('stop and restart are one timeline, with no dose during the stopped interval',()=>{
  let events=[];
  for(const e of [rate('a',0),rate('s',20,0),rate('b',40)])events=upsertCondition(events,e);
  const data=curve(events);assert.equal(data.find(d=>d.time===20).cp,data.find(d=>d.time===40).cp);
  assert.equal(new Set(events.map(e=>e.seriesId)).size,1);
});
test('moving and deleting an existing rate preserve other IDs and recompute boundaries',()=>{
  let events=[];
  for(const e of [rate('a',0),rate('b',30,120),rate('s',60,0)])events=upsertCondition(events,e);
  events=upsertCondition(events,{...events.find(e=>e.id==='b'),time:45,rate:90});
  assert.equal(events.length,3);assert.equal(events.find(e=>e.id==='a').duration,45);
  assert.equal(events.find(e=>e.id==='b').duration,15);
  events=deleteCondition(events,'b');assert.equal(events.find(e=>e.id==='a').duration,60);
  assert.equal(events.find(e=>e.id==='s').time,60);
});
test('same-time infusion collision is atomic and never deletes an existing condition',()=>{
  const events=upsertCondition([],rate('a',0)),before=structuredClone(events);
  assert.throws(()=>upsertCondition(events,rate('new',0)),e=>e.code==='RATE_COLLISION');
  assert.deepEqual(events,before);
  assert.equal(upsertCondition(events,{...events[0],rate:120}).length,1);
});
test('legacy finite infusion adoption preserves its stop and numeric curve',()=>{
  const original=[{...rate('legacy',0),uiSingle:undefined,seriesId:undefined,isInfinite:false,duration:20}];
  const before=structuredClone(original),adopted=adoptSingle(original,'Fentanyl');
  assert.deepEqual(original,before);assert.equal(adopted.find(e=>e.importedStopFor==='legacy').time,20);
  const a=curve(original),b=curve(adopted);a.forEach((d,i)=>assert(Math.abs(d.cp-b[i].cp)<1e-10));
});
test('identified legacy changes preserve dose across adoption',()=>{
  const original=[{...rate('a',0),uiSingle:undefined,seriesId:'old',duration:30,isInfinite:false},
    {...rate('b',30,120),uiSingle:undefined,seriesId:'old',duration:20,isInfinite:false}];
  const adopted=adoptSingle(original,'Fentanyl');
  assert.equal(adopted.filter(e=>e.importedStopFor).length,1);
  assert.equal(adopted.find(e=>e.importedStopFor).time,50);
  curve(original).forEach((d,i)=>assert(Math.abs(d.cp-curve(adopted)[i].cp)<1e-10));
});
test('multiple imported streams and their metadata remain unchanged',()=>{
  const original=[{...rate('a',0),uiSingle:undefined,seriesId:'pump:a',entryStatus:'planned'},
    {...rate('b',10),uiSingle:undefined,seriesId:'pump:b'}],before=structuredClone(original);
  assert(legacyStreams(original,'Fentanyl'));
  assert.throws(()=>upsertCondition(original,rate('c',20)),e=>e.code==='LEGACY_STREAMS');
  assert.throws(()=>deleteCondition(original,'a'),e=>e.code==='LEGACY_STREAMS');
  assert.deepEqual(original,before);assert.equal(upsertCondition(original,bolus('extra',10)).length,3);
});
test('overlapping legacy intervals in one named stream are not silently truncated',()=>{
  const original=[{...rate('a',0),uiSingle:undefined,seriesId:'old'},
    {...rate('b',30),uiSingle:undefined,seriesId:'old'}],before=structuredClone(original);
  assert(legacyStreams(original,'Fentanyl'));
  assert.throws(()=>adoptSingle(original,'Fentanyl'),e=>e.code==='LEGACY_STREAMS');
  assert.deepEqual(original,before);
});
test('partial decimals are pending; invalid values do not produce accepted numbers',()=>{
  for(const text of ['', '.', '1.'])assert.equal(decimalInput(text).status,'pending');
  for(const text of ['-1','NaN','Infinity','1e309','0'])assert.equal(decimalInput(text).status,'invalid');
  assert.equal(decimalInput('.25').value,.25);assert.equal(decimalInput('1,25').value,1.25);
});
test('internal clock keeps previous and following days across midnight',()=>{
  assert.deepEqual(clockParts(10,'23:55'),{hour:'00',minute:'05',day:1});
  assert.deepEqual(clockParts(-10,'00:05'),{hour:'23',minute:'55',day:-1});
  assert.equal(clockToMinutes('23:55','00:05',0),-10);
  assert.equal(clockToMinutes('00:05','23:55',10),10);
});
test('changing only time preserves stored absolute rate and unit conversion',()=>{
  const event=createInfusion('Propofol',0,2,'mg/kg/hr',70,convertToStandardUnit,'prop');
  const edited=upsertCondition([event],{...event,time:-5});
  assert.equal(edited[0].rate,140);assert.equal(edited[0].originalUnit,'mg/kg/hr');
  assert.equal(edited[0].weightAtEntry,70);
});
test('one edit gesture is one undo step, and new edits invalidate redo',()=>{
  const h=createUndoHistory([bolus('b',0)]);
  h.update([bolus('b',1)],'edit');h.update([bolus('b',2,120)],'edit');
  assert.equal(h.undo()[0].time,0);assert.equal(h.redo()[0].time,2);
  h.endGroup();h.update([bolus('b',3)],'edit');assert.equal(h.undo()[0].time,2);
  h.update([bolus('b',4)],'other');assert.equal(h.canRedo,false);
});
test('legacy backup is byte-for-byte, and schema 5 never overwrites the old key',()=>{
  const raw=JSON.stringify(snapshot([rate('a',0)])),s=memory({[LEGACY_KEY]:raw});
  const loaded=readSimpleStorage(s);assert.equal(loaded.imported,true);assert.equal(s.getItem(BACKUP_KEY),raw);
  writeSimpleStorage(s,{...loaded.data,events:[bolus('b',10)]});
  assert.equal(s.getItem(LEGACY_KEY),raw);assert.equal(s.getItem(BACKUP_KEY),raw);
  assert.equal(readSimpleStorage(s).data.events[0].id,'b');
});
test('backup failure, malformed saves and unsupported versions never write schema 5',()=>{
  const raw=JSON.stringify(snapshot([])),s=memory({[LEGACY_KEY]:raw});s.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>readSimpleStorage(s));assert.equal(s.getItem(SIMPLE_KEY),null);assert.equal(s.getItem(LEGACY_KEY),raw);
  const invalid=memory({[LEGACY_KEY]:'broken'});assert.throws(()=>readSimpleStorage(invalid));assert.equal(invalid.getItem(LEGACY_KEY),'broken');
  assert.throws(()=>validateSimpleSnapshot({...snapshot([]),schemaVersion:6}));
});
test('saved display preferences and clock are validated without mutating imported data',()=>{
  const original={...snapshot([]),plotStart:-10,manualRange:true,entryMinute:10},before=structuredClone(original);
  assert.equal(validateSimpleSnapshot(original).entryMinute,10);assert.deepEqual(original,before);
  assert.throws(()=>validateSimpleSnapshot({...original,plotStart:120}));
  assert.throws(()=>validateSimpleSnapshot({...original,entryMinute:2000}));
});
test('negative-time sampling shows the retrospective event and preserves nonnegative outputs',()=>{
  const events=[bolus('past',-5),rate('r',0),rate('s',30,0)],processed=processEvents(events,120);
  const normal=simulateConcentration(processed,p,120,'Fentanyl'),extended=simulateConcentration(processed,p,120,'Fentanyl',-10);
  assert.equal(extended[0].cp,0);assert.equal(extended.find(d=>d.time===-5).cp,10);
  normal.forEach(d=>assert(Math.abs(d.cp-extended.find(q=>q.time===d.time).cp)<1e-10));
});
for(const drug of ['Fentanyl','Hydromorphone','Propofol','Remimazolam'])test(drug+': prehistory drawing samples retain the established Cp/Ce outputs',()=>{
  const params=getPKParameters(drug,getBestModel(drug,patient.age),patient);
  const events=[{id:'b',drug,type:'bolus',time:-10.5,amount:2},{id:'i',drug,type:'infusion',time:3.25,rate:2,isInfinite:false,duration:25}];
  const processed=processEvents(events,60),a=simulateConcentration(processed,params,60,drug),b=simulateConcentration(processed,params,60,drug,-15);
  assert.deepEqual(b.filter(d=>d.time>=0),a);
});
test('fractional sampling boundaries are unique and invalid ranges reject',()=>{
  const data=simulateConcentration([],p,.5,'Fentanyl',.5);assert.equal(data.length,1);assert.equal(data[0].time,.5);
  assert.throws(()=>simulateConcentration([],p,60,'Fentanyl',61));
});
test('editing time after a 70kg to 35kg weight change retains the 140mg/hr absolute rate',()=>{
  const original=createInfusion('Propofol',0,2,'mg/kg/hr',70,convertToStandardUnit,'prop');
  const edited=editCondition(original,{type:'infusion',drug:'Propofol',time:10,value:2,unit:'mg/kg/hr',rateChanged:false},35,convertToStandardUnit);
  assert.equal(edited.rate,140);assert.equal(edited.originalRate,2);assert.equal(edited.weightAtEntry,70);assert.equal(edited.id,original.id);
  const intended=editCondition(original,{type:'infusion',drug:'Propofol',time:10,value:2,unit:'mg/kg/hr',rateChanged:true},35,convertToStandardUnit);
  assert.equal(intended.rate,70);
});
test('empty clock fields never become 00 when blurring either part',()=>{
  for(const blur of [false,true]){
    assert.equal(clockFields('','30',blur).status,'pending');assert.equal(clockFields('09','',blur).status,'pending');
    assert.equal(clockFields('','',blur).status,'pending');
  }
  assert.deepEqual(clockFields('09','30',true),{status:'valid',hour:'09',minute:'30'});
  assert.equal(clockFields('9','3').status,'pending');
  assert.deepEqual(clockFields('9','3',true),{status:'valid',hour:'09',minute:'03'});
  assert.equal(clockFields('24','30',true).status,'invalid');
});
