import test from 'node:test';
import assert from 'node:assert/strict';
import {graphContext} from '../src/lib/graphContext.js';
import {chooseModel,resolveModel,getBestModel} from '../src/lib/modelSelection.js';
import {getPKParameters} from '../src/lib/drugs.js';
import {simulateConcentration,processEvents} from '../src/lib/solver.js';
const dose=(drug,time)=>({id:'b',drug,time,type:'bolus',amount:100});
test('display bounds, clock reference and first dose have distinct meanings',()=>{
  const events=[dose('Fentanyl',-10)],before=structuredClone(events);
  const context=graphContext({range:{start:-10,end:120},startTime:'10:00',currentMinute:30,events,drug:'Fentanyl'});
  assert.deepEqual(context,{start:'09:50',end:'12:00',spanMinutes:130,reference:'10:00',now:'10:30',firstDose:'09:50'});
  const zoom=graphContext({range:{start:0,end:30},startTime:'10:00',currentMinute:30,events,drug:'Fentanyl'});
  assert.equal(zoom.firstDose,'09:50');assert.equal(zoom.reference,'10:00');assert.deepEqual(events,before);
});
test('graph context preserves midnight day offsets and ignores stop-only conditions',()=>{
  const events=[{id:'stop',drug:'Propofol',type:'infusion',rate:0,time:-20},dose('Fentanyl',-10),dose('Propofol',10)];
  const context=graphContext({range:{start:-10,end:120},startTime:'23:55',currentMinute:20,events,drug:'Propofol'});
  assert.equal(context.start,'23:45');assert.equal(context.end,'01:55 (+1d)');assert.equal(context.firstDose,'00:05 (+1d)');
  assert.equal(graphContext({range:{start:0,end:120},startTime:'10:00',currentMinute:0,events:[],drug:'Fentanyl'}).firstDose,null);
});
test('Auto resolves using the existing age rules; manual models remain selected',()=>{
  for(const drug of ['Fentanyl','Hydromorphone','Morphine','Propofol'])for(const age of [.5,10,35])
    assert.equal(resolveModel(drug,age,{}),getBestModel(drug,age));
  const original={Fentanyl:'Shafer (Adult)',Propofol:'Eleveld (2018) General-purpose'};
  assert.equal(resolveModel('Fentanyl',10,original),'Shafer (Adult)');
  const automatic=chooseModel(original,'Fentanyl','auto');
  assert(!('Fentanyl' in automatic));assert.equal(automatic.Propofol,original.Propofol);assert.equal(original.Fentanyl,'Shafer (Adult)');
  assert.equal(resolveModel('Fentanyl',10,automatic),'Ginsberg (Pediatric)');
  assert.equal(resolveModel('Fentanyl',35,automatic),'Bae (2020) Adult');
});
test('Auto uses exactly the existing model parameters and concentration calculation',()=>{
  const patient={age:35,weight:70,height:175,gender:'male'},events=[dose('Fentanyl',0)];
  const before=getPKParameters('Fentanyl',getBestModel('Fentanyl',35),patient);
  const after=getPKParameters('Fentanyl',resolveModel('Fentanyl',35,{}),patient);
  assert.deepEqual(after,before);
  assert.deepEqual(simulateConcentration(processEvents(events,120),before,120,'Fentanyl'),
    simulateConcentration(processEvents(events,120),after,120,'Fentanyl'));
});
