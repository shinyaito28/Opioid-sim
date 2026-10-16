import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToString} from 'react-dom/server';
import i18next from 'i18next';
import {I18nextProvider,initReactI18next} from 'react-i18next';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {doseMarkers} from '../src/lib/doseMarkers.js';

let server,App,ViewportDialog,SavedCaseList,PatientFields,DoseMarkerValues;
const en=JSON.parse(fs.readFileSync(new URL('../src/locales/en.json',import.meta.url)));
const ja=JSON.parse(fs.readFileSync(new URL('../src/locales/ja.json',import.meta.url)));
before(async()=>{
  server=await createServer({configFile:false,plugins:[react()],server:{middlewareMode:true},appType:'custom'});
  App=(await server.ssrLoadModule('/src/App.jsx')).default;
  ViewportDialog=(await server.ssrLoadModule('/src/components/ViewportDialog.jsx')).default;
  SavedCaseList=(await server.ssrLoadModule('/src/components/ScenarioMenu.jsx')).SavedCaseList;
  PatientFields=(await server.ssrLoadModule('/src/components/PatientChip.jsx')).PatientFields;
  DoseMarkerValues=(await server.ssrLoadModule('/src/components/DoseMarkerValues.jsx')).default;
});

for(const language of ['en','ja'])test(language+': marker amounts, rates and stop values render without hovering or selecting',async()=>{
  const i18n=i18next.createInstance();await i18n.init({lng:language,resources:{en:{translation:en},ja:{translation:ja}},interpolation:{escapeValue:false}});
  const events=[{id:'b',drug:'Fentanyl',type:'bolus',time:0,amount:25},
    {id:'start',drug:'Fentanyl',type:'infusion',time:0,rate:70,originalUnit:'mcg/kg/hr',duration:10,isInfinite:false,uiSingle:true},
    {id:'change',drug:'Fentanyl',type:'infusion',time:10,rate:140,originalUnit:'mcg/kg/hr',duration:10,isInfinite:false,uiSingle:true},
    {id:'stop',drug:'Fentanyl',type:'infusion',time:20,rate:0,originalUnit:'mcg/kg/hr',duration:60,isInfinite:true,uiSingle:true}];
  const groups=doseMarkers(events,'Fentanyl',{start:0,end:30},300,5),t=i18n.t.bind(i18n);
  const html=renderToString(React.createElement(DoseMarkerValues,{groups,events,weight:70,startTime:'23:50',color:'#2563eb',t}));
  for(const value of ['25 mcg','1 mcg/kg/hr','2 mcg/kg/hr','0 mcg/kg/hr'])assert(html.includes('>'+value+'</strong>'),value);
  for(const key of ['markerBolus','markerStart','markerChange','markerStop'])assert(html.includes(t(key)));
  assert(html.includes(t('entryDrugFentanyl')));assert(html.includes('border-color:#2563eb'));
  assert.equal((html.match(/class="marker-numeric"/g)||[]).length,4);
  assert(html.includes('#1'));assert(html.includes('00:00 (+1d)'));assert(!html.includes('<details'));assert(!html.includes('hidden'));
  const dense=Array.from({length:100},(_,index)=>({...events[0],id:'dense-'+index,amount:index+1}));
  const denseHTML=renderToString(React.createElement(DoseMarkerValues,{groups:doseMarkers(dense,'Fentanyl',{start:0,end:30},270),events:dense,weight:70,startTime:'09:00',color:'#2563eb',t}));
  assert.equal((denseHTML.match(/class="marker-numeric"/g)||[]).length,100);assert(denseHTML.includes('>100 mcg</strong>'));
});
after(async()=>{await server?.close();});
for(const language of ['en','ja'])test(language+': complete UI renders with one clock, common tabs, and no old status/preset controls',async()=>{
  const i18n=i18next.createInstance();
  await i18n.use(initReactI18next).init({lng:language,resources:{en:{translation:en},ja:{translation:ja}},interpolation:{escapeValue:false}});
  const html=renderToString(React.createElement(I18nextProvider,{i18n},React.createElement(App)));
  assert.equal((html.match(/data-testid="shared-clock"/g)||[]).length,1);
  assert.equal((html.match(/role="tab"/g)||[]).length,2);
  assert(html.includes('data-testid="dose-add"'));assert(html.includes('data-testid="simple-graph"'));
  assert(html.indexOf('data-testid="new-case"')<html.indexOf('data-testid="simple-dose-panel"'));
  assert(html.indexOf('data-testid="simple-history"')>html.indexOf('class="graph-canvas"'));
  if(language==='en')assert(/data-testid="language-ja"[^>]*>JP<\/button>/.test(html));
  assert(html.includes('data-testid="graph-model"'));assert(html.includes('data-testid="graph-used-model"'));
  assert(html.includes('data-testid="graph-time-context"'));assert(html.includes('value="auto" selected'));
  assert(html.includes('data-testid="graph-y-controls"'));assert(html.includes('data-testid="graph-band-note"'));
  assert(html.includes('data-testid="graph-fit"'));assert(html.includes(language==='en'?'Fit to data':'全体に合わせる'));
  assert.equal((html.match(/type="range"/g)||[]).length,2);
  assert(html.includes('data-testid="graph-y-limit"'));assert(html.includes('aria-pressed="true"'));
  assert(!html.includes('graphBandAnalgesia'));assert(!html.includes('graphYAxis'));
  assert(html.includes(language==='en'?'Not a safety range.':'安全域を示すものではありません。'));
  assert(!html.includes('quick-status-'));assert(!html.includes('include-planned'));
  assert(!html.includes('For Research/Edu Only'));assert(!html.includes('6h</button>'));
  assert(!html.includes('12h</button>'));assert(!html.includes('24h</button>'));
  assert(!html.includes('simpleTime'));assert(!html.includes('simpleAddBolus'));
  assert(html.includes(language==='en'?'Anesthesia PK/PD Simulator':'麻酔薬濃度シミュレーター'));
  if(language==='ja'){
    for(const label of ['Drug','Dose','Bolus','Infusion','Auto','Saved Cases','Male','Female'])assert(!new RegExp('>'+label+'<').test(html),label);
    for(const drug of ['Fentanyl','Hydromorphone','Morphine','Propofol','Remifentanil','Methadone','Sufentanil','Ketamine','Dexmedetomidine','Remimazolam'])assert(html.includes(ja['entryDrug'+drug]));
  }
});

for(const language of ['en','ja'])test(language+': long saved cases and patient fields render in a labelled, closable dialog',async()=>{
  const i18n=i18next.createInstance();
  await i18n.init({lng:language,resources:{en:{translation:en},ja:{translation:ja}},interpolation:{escapeValue:false}});
  const t=i18n.t.bind(i18n),name='Long case / 長い症例名 '.repeat(12);
  const child=React.createElement(SavedCaseList,{savedScenarios:[{id:'case',name,data:{events:[{}],drug:'Fentanyl',modelByDrug:{Fentanyl:'Bae (2020) Adult'}}}],currentScenarioId:'case',isModified:true,onLoad:()=>{},deleteScenario:()=>{},t});
  const html=renderToString(React.createElement(ViewportDialog,{open:true,onClose:()=>{},title:t('savedCases'),t,width:460},child));
  assert(html.includes('role="dialog"'));assert(html.includes('aria-modal="true"'));assert(html.includes('aria-labelledby='));
  assert(html.includes('aria-label="'+t('close')+'"'));assert(html.includes(name));assert(html.includes('Bae (2020) Adult'));
  assert(html.includes(t('caseEventCount',{count:1})));assert(html.includes(t('load')));
  const fields=renderToString(React.createElement(PatientFields,{patient:{age:35,weight:70,height:175,gender:'male'},setPatient:()=>{},autoFillStats:true,setAutoFillStats:()=>{},activeParams:['weight'],t}));
  assert(fields.includes(t('male')));assert(fields.includes(t('female')));assert(fields.includes(t('paramUnused')));
  if(language==='ja')assert(!fields.includes('weight')); // Model hint uses translated field labels.
});
