import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPKParameters, DRUG_UNITS, convertToStandardUnit, convertFromStandardUnit, THERAPEUTIC_RANGES, DRUG_DISPLAY } from '../src/lib/drugs.js';
import { processEvents, simulateConcentration } from '../src/lib/simulation.js';
import { validateEvent, validatePatient } from '../src/lib/validation.js';
import { validateSnapshot, replaceEvent } from '../src/lib/state.js';
import { summarize, durationAbove } from '../src/lib/metrics.js';
import { scheduleEvent, removeScheduledEvent, preserveEnteredStop } from '../src/lib/schedule.js';
import { infusionDisplay } from '../src/lib/display.js';
import { clockToMinutes, elapsedMinutes } from '../src/lib/clock.js';
import { computeBurdenAUC } from '../src/lib/burden.js';
import { computeAlerts } from '../src/lib/alerts.js';
const patient={age:35,weight:70,height:170,gender:'male'};
const params=getPKParameters('Fentanyl','Bae (2020) Adult',patient);
const bolus=(id,time=0,amount=100)=>({id,drug:'Fentanyl',type:'bolus',time,amount});
const inf=(id,time=0,rate=60,duration=10)=>({id,drug:'Fentanyl',type:'infusion',time,rate,duration,isInfinite:false});
const sim=(events,duration=20,p=params,drug='Fentanyl')=>simulateConcentration(processEvents(events,duration),p,duration,drug);
const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}; error ${Math.abs(actual-expected)}`);

for(const c of JSON.parse(fs.readFileSync(new URL('./reference-fixtures.json',import.meta.url))).cases){
 test(`${c.drug}: independent matrix-exponential reference ${c.patient.age}y/${c.patient.weight}kg`,()=>{
  assert.deepEqual(getPKParameters(c.drug,c.model,c.patient),c.params);
  const actual=sim(c.events,c.duration,c.params,c.drug);
  assert.equal(actual.length,c.expected.length);
  for(let i=0;i<actual.length;i++)for(const key of ['cp','ce']){
   assert.equal(actual[i].time,c.expected[i].time);
   close(actual[i][key],c.expected[i][key],Math.max(1e-5,Math.abs(c.expected[i][key])*2e-6));
  }
 });
}
test('Bae Table 2 exact scaling at 35/70/140kg',()=>{
 for(const w of [35,70,140]){const p=getPKParameters('Fentanyl','Bae (2020) Adult',{...patient,weight:w});
  for(const [k,c] of Object.entries({V1:10.1,V2:26.5,V3:206,Cl:.704,Q2:2.38,Q3:1.49}))close(p[k],c*(w/70)**(k.startsWith('V')?1.23:.313));}
});
test('all 26 allowed infusion units round-trip without dose drift',()=>{
 for(const [drug,units] of Object.entries(DRUG_UNITS))for(const weight of [35,70,100])for(const unit of units){
  const converted=convertToStandardUnit(.73,unit,weight,drug);close(convertFromStandardUnit(converted,unit,weight,drug),.73,1e-12);}
 assert.equal(convertToStandardUnit(100,'mcg/kg/min',70,'Propofol'),420);
 assert.equal(convertToStandardUnit(.1,'mcg/kg/min',70,'Remifentanil'),420);
});
test('one-compartment analytic solution: samples have correct timestamps',()=>{
 const p={V1:10,V2:0,V3:0,Cl:1,Q2:0,Q3:0,ke0:.2};const data=sim([bolus('a')],10,p);
 for(const x of data){close(x.cp,10*Math.exp(-.1*x.time),1e-7);close(x.ce,20*(Math.exp(-.1*x.time)-Math.exp(-.2*x.time)),1e-6);}
 assert.deepEqual(data[0],{time:0,cp:10,ce:0});
});
test('fractional event time is exact; negative prehistory retained; fractional horizon sampled',()=>{
 const p={V1:10,V2:0,V3:0,Cl:1,Q2:0,Q3:0,ke0:.2};
 close(sim([bolus('a',.51)],1,p)[1].cp,10*Math.exp(-.049),1e-7);
 close(sim([bolus('a',-1)],1,p)[0].cp,10*Math.exp(-.1),1e-7);
 assert.equal(sim([bolus('a')],1.25,p).at(-1).time,1.25);
});
test('parallel same-drug IDs sum linearly and stop independently',()=>{
 const a=inf('a',0,60,5),b=inf('b',0,120,10),both=sim([a,b]),one=sim([a]),two=sim([b]);
 both.forEach((p,i)=>{close(p.cp,one[i].cp+two[i].cp,1e-10);close(p.ce,one[i].ce+two[i].ce,1e-10);});
});
test('UI rate change removes same-time overlap, truncates past and respects future changes',()=>{
 const a={...inf('a',0),isInfinite:true,seriesId:'default:Fentanyl'},future={...inf('future',20),seriesId:'default:Fentanyl'};
 const next=scheduleEvent([a,future],inf('b',10),true);
 assert.equal(next.find(e=>e.id==='a').duration,10);assert.equal(next.find(e=>e.id==='b').duration,10);
 assert.equal(next.find(e=>e.id==='future').time,20);
 assert.equal(scheduleEvent([a],inf('b',0),true).length,1);
});
test('explicit parallel series survive rate changes; legacy edits replace only one ID',()=>{
 const a={...inf('a'),seriesId:'default:Fentanyl'},b={...inf('b'),parallel:true};
 const next=scheduleEvent([a,b],inf('c',5),true);assert.deepEqual(next.find(e=>e.id==='b'),b);
 const edited=replaceEvent([a,b],{...a,rate:30});assert.equal(edited.length,2);assert.deepEqual(edited[1],b);
});
test('earlier rate change shortens the preceding identified interval',()=>{
 const first=scheduleEvent([{...inf('a',0,60,60),seriesId:'default:Fentanyl'}],inf('b',20,30,20),true);
 const moved=scheduleEvent(first,{...first.find(e=>e.id==='b'),time:10},true);
 assert.equal(moved.find(e=>e.id==='a').duration,10);
});
test('invalid patient, events, units and model parameters throw instead of zero output',()=>{
 for(const bad of [0,-1,NaN,Infinity])assert.throws(()=>getPKParameters('Fentanyl','Bae (2020) Adult',{...patient,weight:bad}));
 assert.throws(()=>validatePatient({...patient,age:-1}));
 assert.throws(()=>getPKParameters('Fentanyl','Minto (Adult)',patient));
 assert.throws(()=>getPKParameters('Remifentanil','Minto (Adult)',{...patient,age:130}));
 for(const duration of [0,-1,NaN,Infinity,1441])assert.throws(()=>sim([inf('a',0,60,duration)]));
 assert.throws(()=>sim([bolus('a',0,Infinity)]));assert.throws(()=>sim([bolus('a'),bolus('a')]));
 assert.throws(()=>convertToStandardUnit(1,'bogus',70,'Fentanyl'));
 assert.throws(()=>convertToStandardUnit(1,'mcg/kg/hr',0,'Fentanyl'));
 assert.throws(()=>convertFromStandardUnit(1e308,'mg/hr',70,'Morphine'));
 assert.throws(()=>simulateConcentration([bolus('a')],{...params,V1:1e-300},10,'Fentanyl'));
});
test('Cp-only models return Ce unavailable, not zero; no Ce alerts or durations',()=>{
 for(const [drug,model] of [['Ketamine','Noppers (2011) S-ketamine'],['Dexmedetomidine','Hannivoort (2015) Adult']]){
  const data=sim([{...bolus('a'),drug,amount:10}],10,getPKParameters(drug,model,patient),drug);
  assert(data.every(p=>p.ce===null));assert(data[0].cp>0);assert.equal(durationAbove(data,1),0);
  const m=summarize(data,[{...bolus('a'),drug}],drug,10,THERAPEUTIC_RANGES[drug],DRUG_DISPLAY[drug],'mg');
  assert.equal(m.hasCe,false);assert.equal(m.respRiskMin,null);assert.equal(m.onsetTime,null);
  assert.deepEqual(computeAlerts({simByDrug:new Map([[drug,data]]),ranges:{[drug]:{analgesiaMin:1,respiratoryRisk:2}},activeOpioids:[drug],simDuration:10,events:[]}),[]);
 }
});
test('Propofol and Remimazolam summaries compare ng/mL only once',()=>{
 for(const [drug,model,dose,rate] of [['Propofol','Eleveld (2018) General-purpose',100,420],['Remimazolam','Eleveld (2025) Adult',7,70]]){
  const events=[{...bolus('a'),drug,amount:dose},{...inf('b',0,rate,60),drug}],data=sim(events,120,getPKParameters(drug,model,patient),drug);
  const m=summarize(data,events,drug,120,THERAPEUTIC_RANGES[drug],DRUG_DISPLAY[drug],'mg');
  assert.equal(m.onsetTime,data.find(p=>p.ce>=THERAPEUTIC_RANGES[drug].bisTarget.min)?.time??null);
  assert.equal(m.onsetThreshold,THERAPEUTIC_RANGES[drug].bisTarget.min/1000);
  if(drug==='Remimazolam')assert(m.respRiskMin>0);
 }
});
test('summary horizon clipping, overrides and ongoing infusion recovery',()=>{
 const events=[bolus('a',20),inf('b',0,60,60)];const data=sim(events,10);
 const m=summarize(data,events,'Fentanyl',10,{analgesiaMin:.01,respiratoryRisk:.02},DRUG_DISPLAY.Fentanyl,'mcg');
 assert.equal(m.totalDose,10);assert(m.onsetTime!==null);assert.equal(m.recoveryTime,null);
 const both=[inf('a',0,60,5),{...inf('b',0),isInfinite:true}];
 assert.equal(summarize(sim(both),both,'Fentanyl',20,{analgesiaMin:1e6},DRUG_DISPLAY.Fentanyl,'mcg').recoveryTime,null);
});
test('duration uses actual intervals and crossing interpolation; 5 samples are 4 minutes',()=>{
 const data=Array.from({length:5},(_,time)=>({time,ce:2}));assert.equal(durationAbove(data,1,'ce',true),4);
 close(durationAbove([{time:0,ce:0},{time:2,ce:4}],2),1);
 const range={analgesiaMin:0,respiratoryRisk:1};assert(!computeAlerts({simByDrug:new Map([['Fentanyl',data]]),ranges:{Fentanyl:range},events:[],activeOpioids:['Fentanyl'],simDuration:4}).some(a=>a.id==='Fentanyl-sustainedResp'));
});
test('AUC integrates fractional time intervals',()=>{
 assert.equal(computeBurdenAUC([{time:0,ce:2},{time:1.5,ce:2}],{analgesiaMin:1,analgesiaMax:3}).total,3);
});
test('midnight clock and date-anchored elapsed time survive next day',()=>{
 assert.equal(clockToMinutes('00:30','23:00'),90);assert.equal(clockToMinutes('08:00','09:00'),-60);
 assert.equal(clockToMinutes('00:30','09:00',900),930);
 assert.equal(elapsedMinutes(new Date(2026,9,5,0,30),'2026-10-04','23:00'),90);
});
test('saved patient, all drug models, overrides and clock/relative state restore exactly',()=>{
 const d={schemaVersion:3,patient:{...patient,weight:100,height:180},drug:'Fentanyl',modelByDrug:{Fentanyl:'Shafer (Adult)',Hydromorphone:'Jeleazcov (2014) Adult'},
  events:[bolus('a'),{...inf('b'),drug:'Hydromorphone'}],simDuration:120,autoFillStats:false,isClockMode:false,
  clockStartDate:'2026-10-04',startTime:'23:00',therapeuticOverrides:{Fentanyl:{analgesiaMin:1,analgesiaMax:3}}};
 assert.deepEqual(validateSnapshot(JSON.parse(JSON.stringify(d))),d);
 const legacy=validateSnapshot({patient,drug:'Fentanyl',model:'Shafer (Adult)',events:[{id:1,type:'bolus',time:0,amount:100}],simDuration:120,startTime:null});
 assert.equal(legacy.autoFillStats,false);assert.equal(legacy.events[0].drug,'Fentanyl');assert.equal(legacy.modelByDrug.Fentanyl,'Shafer (Adult)');
 assert.throws(()=>validateSnapshot({...d,modelByDrug:{Remifentanil:'Shafer (Adult)'}}));
 assert.throws(()=>validateSnapshot({...d,therapeuticOverrides:{Fentanyl:{analgesiaMin:4,analgesiaMax:3}}}));
 assert.throws(()=>validateSnapshot({...d,clockStartDate:'2026-02-31'}));
 assert.throws(()=>validateSnapshot({...d,savedTraces:{}}));
});
test('weight-normalized display follows stored absolute rate after weight change',()=>{
 const e={...inf('a',0,70),originalUnit:'mcg/kg/hr',originalRate:1};
 assert.deepEqual(infusionDisplay(e,100),{value:.7,unit:'mcg/kg/hr'});
});

test('unmarked legacy parallel infusions are never collapsed or shortened by a new entry',()=>{
 const legacy=[{...inf('a',0),isInfinite:true},{...inf('b',0),isInfinite:true}];
 const before=JSON.stringify(legacy);
 for(const time of [0,10]) assert.throws(()=>scheduleEvent(legacy,inf('new',time),true),e=>e.code==='AMBIGUOUS_INFUSION');
 assert.equal(JSON.stringify(legacy),before);
 const different=[{...legacy[0],time:0},{...legacy[1],time:5}];
 assert.throws(()=>scheduleEvent(different,inf('new',10),true),e=>e.code==='AMBIGUOUS_INFUSION');
 const preserved=scheduleEvent(legacy,{...inf('new',10),parallel:true},true);
 assert.deepEqual(preserved.slice(0,2),legacy);
});
test('explicit series changes leave unmarked and separately identified pumps unchanged',()=>{
 const a={...inf('a',0),isInfinite:true,seriesId:'pump-A'};
 const legacy={...inf('legacy',0),isInfinite:true};
 const b={...inf('b',0),isInfinite:true,seriesId:'pump-B'};
 const next=scheduleEvent([a,legacy,b],{...inf('c',10),seriesId:'pump-A'},true);
 assert.equal(next.find(e=>e.id==='a').duration,10);
 assert.deepEqual(next.find(e=>e.id==='legacy'),legacy);assert.deepEqual(next.find(e=>e.id==='b'),b);
});
test('moving a change later and deleting it restore the entered infinite stop',()=>{
 const first=scheduleEvent([], {...inf('a',0),isInfinite:true},true);
 const split=scheduleEvent(first,inf('b',20),true);
 const moved=scheduleEvent(split,{...split.find(e=>e.id==='b'),time:30},true);
 assert.equal(moved.find(e=>e.id==='a').duration,30);
 assert.equal(moved.find(e=>e.id==='a').isInfinite,false);
 assert.equal(removeScheduledEvent(moved,'b')[0].isInfinite,true);
});
test('rate change movement and removal never extend an explicitly entered finite stop',()=>{
 const first=scheduleEvent([],inf('a',0,60,25),true);
 const split=scheduleEvent(first,inf('b',20),true);
 const moved=scheduleEvent(split,{...split.find(e=>e.id==='b'),time:30},true);
 assert.equal(moved.find(e=>e.id==='a').duration,25);
 assert.equal(removeScheduledEvent(moved,'b')[0].duration,25);
 const changed=scheduleEvent(split,{...split.find(e=>e.id==='a'),duration:15,seriesLimit:undefined},true);
 assert.equal(removeScheduledEvent(changed,'b')[0].duration,15);
 assert.throws(()=>validateSnapshot({patient,drug:'Fentanyl',events:[{...first[0],seriesLimit:{duration:-1,isInfinite:false}}],simDuration:120}));
});

test('rate-only and unchanged form edits preserve the entered stop through later movement and deletion',()=>{
 const first=scheduleEvent([], {...inf('a',0),isInfinite:true},true);
 const split=scheduleEvent(first,inf('b',20),true);const old=split.find(e=>e.id==='a');
 for(const rate of [old.rate,30]){
  const edited=scheduleEvent(split,preserveEnteredStop(old,{...old,rate}),true);
  const moved=scheduleEvent(edited,{...edited.find(e=>e.id==='b'),time:30},true);
  assert.equal(moved.find(e=>e.id==='a').duration,30);
  assert.equal(removeScheduledEvent(moved,'b')[0].isInfinite,true);
 }
 const explicit=scheduleEvent(split,preserveEnteredStop(old,{...old,duration:15}),true);
 assert.equal(removeScheduledEvent(explicit,'b')[0].duration,15);
});
test('changing a series event to a bolus or another drug restores the previous series',()=>{
 const first=scheduleEvent([], {...inf('a',0),isInfinite:true},true);
 const split=scheduleEvent(first,inf('b',20),true);const old=split.find(e=>e.id==='b');
 for(const replacement of [{...bolus('b',20)},{...old,drug:'Morphine'}]){
  const result=scheduleEvent(split,preserveEnteredStop(old,replacement),false);
  assert.equal(result.find(e=>e.id==='a').isInfinite,true);
  assert.equal(result.find(e=>e.id==='b').seriesId,undefined);
 }
});
