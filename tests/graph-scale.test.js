import test from 'node:test';
import assert from 'node:assert/strict';
import {concentrationBand,parseYAxisMax,suggestedYAxisMax} from '../src/lib/graphScale.js';
import {THERAPEUTIC_RANGES,DRUG_DISPLAY} from '../src/lib/drugs.js';

test('manual Y upper limits accept only complete finite positive values',()=>{
  for(const value of ['', '.', '1.', '0', '-1', 'NaN', 'Infinity', '1e', '1e309',' 2 '])assert.equal(parseYAxisMax(value),null,value);
  for(const [value,number] of [['1',1],['.25',.25],['2.5',2.5],['1e3',1000]])assert.equal(parseYAxisMax(value),number);
  assert.equal(suggestedYAxisMax([],null),1);
  assert.equal(suggestedYAxisMax([{cp:10,ce:3}],null),11);
  assert.equal(suggestedYAxisMax([{cp:1,ce:null}],{upper:5}),5.5);
});

test('reference bands use the actual configured bounds, units and drug-specific meaning',()=>{
  assert.deepEqual(concentrationBand('Fentanyl',THERAPEUTIC_RANGES.Fentanyl,1),{lower:.5,upper:2.5,labelKey:'graphBandAnalgesia'});
  assert.deepEqual(concentrationBand('Hydromorphone',THERAPEUTIC_RANGES.Hydromorphone,1),{lower:4,upper:8,labelKey:'graphBandAnalgesia'});
  assert.deepEqual(concentrationBand('Propofol',THERAPEUTIC_RANGES.Propofol,DRUG_DISPLAY.Propofol.divisor),{lower:3,upper:5,labelKey:'graphBandPropofol'});
  assert.deepEqual(concentrationBand('Remimazolam',THERAPEUTIC_RANGES.Remimazolam,DRUG_DISPLAY.Remimazolam.divisor),{lower:.4,upper:.8,labelKey:'graphBandRemimazolam'});
  for(const drug of ['Ketamine','Dexmedetomidine'])assert.equal(concentrationBand(drug,THERAPEUTIC_RANGES[drug],DRUG_DISPLAY[drug].divisor||1),null);
  assert.deepEqual(concentrationBand('Fentanyl',{analgesiaMin:1,analgesiaMax:3},1),{lower:1,upper:3,labelKey:'graphBandAnalgesia'});
  assert.equal(concentrationBand('Fentanyl',{analgesiaMin:3,analgesiaMax:1},1),null);
});
