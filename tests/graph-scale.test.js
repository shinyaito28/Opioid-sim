import test from 'node:test';
import assert from 'node:assert/strict';
import {concentrationBand,suggestedYAxisMax,yAxisSlider,yAxisFromSlider} from '../src/lib/graphScale.js';
import {THERAPEUTIC_RANGES,DRUG_DISPLAY} from '../src/lib/drugs.js';

test('Auto Y upper limits include curves and the displayed reference band',()=>{
  assert.equal(suggestedYAxisMax([],null),1);
  assert.equal(suggestedYAxisMax([{cp:10,ce:3}],null),11);
  assert.equal(suggestedYAxisMax([{cp:1,ce:null}],{upper:5}),5.5);
});

test('Y bar stays positive, monotonic and centered on each drug display scale',()=>{
  for(const automatic of [.01,.5,5,100,10000]){
    const slider=yAxisSlider(automatic);
    assert.equal(slider.value,Math.sqrt(automatic));assert.equal(slider.lower,automatic/20);assert.equal(slider.upper,automatic*5);
    let previous=0;
    for(let index=0;index<=100;index++){
      const value=yAxisFromSlider(String(slider.min+(slider.max-slider.min)*index/100),slider);
      assert(value>0&&Number.isFinite(value)&&value>=previous);previous=value;
    }
    assert.equal(yAxisFromSlider(String(slider.value),slider),automatic);
    for(const raw of ['', '0', '-1', 'NaN', 'Infinity'])assert.equal(yAxisFromSlider(raw,slider),null);
  }
});

test('manual limit remains representable when data changes, while a new drug starts with Auto',()=>{
  const manual=yAxisSlider(100,1);
  assert.equal(manual.value,1);assert.equal(manual.lower,1);
  assert.equal(yAxisFromSlider(String(manual.value),manual),1);
  const auto=yAxisSlider(.5,null);
  assert.equal(auto.value,Math.sqrt(.5));assert.equal(yAxisFromSlider(String(auto.value),auto),.5);
  assert(Number.isFinite(suggestedYAxisMax([{cp:Number.MAX_VALUE,ce:null}],null)));
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
