import test from 'node:test';
import assert from 'node:assert/strict';
import {standaloneMode,appViewportFrame,installAppViewport,scrollApplicationBy,revealInstalledInput} from '../src/lib/appViewport.js';

function emitter(fields={}) {
  const listeners=new Map();
  return Object.assign(fields,{addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener:(type,fn)=>listeners.get(type)?.delete(fn),emit:type=>{for(const fn of listeners.get(type)||[])fn();},listenerCount:()=>[...listeners.values()].reduce((sum,set)=>sum+set.size,0)});
}
function environment(installed=true) {
  const values=new Map(),media=emitter({matches:installed}),viewport=emitter({width:390,height:844,offsetTop:0,offsetLeft:0,scale:1});
  const host=emitter({innerWidth:390,innerHeight:844,navigator:{},visualViewport:viewport,matchMedia:()=>media});
  const root={dataset:{},style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)}};
  const document={documentElement:root,querySelector:()=>null,activeElement:null};
  return {host,document,values,media,viewport};
}

test('installed-app detection uses display mode or legacy standalone, not screen size or device guesses',()=>{
  assert.equal(standaloneMode({matchMedia:()=>({matches:true})}),true);
  assert.equal(standaloneMode({navigator:{standalone:true},matchMedia:()=>({matches:false})}),true);
  assert.equal(standaloneMode({navigator:{standalone:false},matchMedia:()=>({matches:false})}),false);
  assert.equal(standaloneMode({}),false);
});

test('PWA viewport responds to keyboard open/close, pan and rotation, then leaves Safari document layout alone',()=>{
  const {host,document,values,media,viewport}=environment(),stop=installAppViewport(host,document);
  assert.equal(document.documentElement.dataset.standalone,'true');assert.equal(values.get('--app-viewport-height'),'844px');
  viewport.height=420;viewport.offsetTop=100;viewport.emit('resize');
  assert.equal(values.get('--app-viewport-height'),'420px');assert.equal(values.get('--app-viewport-top'),'100px');
  Object.assign(viewport,{width:844,height:390,offsetTop:0});host.emit('resize');
  assert.equal(values.get('--app-viewport-width'),'844px');assert.equal(values.get('--app-viewport-height'),'390px');
  Object.assign(viewport,{width:390,height:844});viewport.emit('resize');
  assert.equal(values.get('--app-viewport-height'),'844px');assert.equal(values.get('--app-viewport-top'),'0px');
  media.matches=false;media.emit('change');
  assert.equal(document.documentElement.dataset.standalone,'false');assert.equal(values.size,0);
  stop();assert.equal(host.listenerCount()+viewport.listenerCount()+media.listenerCount(),0);
});

test('pinch zoom preserves the layout dimensions rather than reflowing to the magnified visual viewport',()=>{
  const {host,viewport}=environment();Object.assign(viewport,{scale:2,width:195,height:422,offsetTop:80,offsetLeft:20});
  assert.deepEqual(appViewportFrame(host),{left:0,top:0,width:390,height:844});
});

test('dose input reveal scrolls the PWA container, while Safari retains its original window-scrolling path',()=>{
  const {host,document}=environment();const calls=[],options={top:44,behavior:'smooth'};
  host.scrollBy=value=>calls.push(['window',value]);document.querySelector=()=>({scrollBy:value=>calls.push(['app',value])});
  document.documentElement.dataset.standalone='true';assert.equal(scrollApplicationBy(host,document,options),'app');
  document.documentElement.dataset.standalone='false';assert.equal(scrollApplicationBy(host,document,options),'window');
  assert.deepEqual(calls,[['app',options],['window',options]]);assert.deepEqual(options,{top:44,behavior:'smooth'});
});

test('keyboard resize reveals an obscured main input without scrolling a background app behind an open dialog',()=>{
  const {host,document,viewport}=environment();document.documentElement.dataset.standalone='true';viewport.height=420;
  const calls=[],input={matches:()=>true,getBoundingClientRect:()=>({top:470,bottom:518})};
  const scroller={contains:value=>value===input,getBoundingClientRect:()=>({top:44,bottom:844}),scrollBy:value=>calls.push(value)};
  document.querySelector=()=>scroller;document.activeElement=input;
  assert.equal(revealInstalledInput(host,document),true);assert.deepEqual(calls,[{top:110,behavior:'auto'}]);
  document.activeElement={matches:()=>true,getBoundingClientRect:()=>({top:470,bottom:518})};
  assert.equal(revealInstalledInput(host,document),false);assert.equal(calls.length,1);
});

test('resize callbacks stop on disposal without mutating browser storage or existing simulation state',()=>{
  const {host,document,values,viewport}=environment();
  host.localStorage={clear:()=>assert.fail('must not clear storage'),removeItem:()=>assert.fail('must not remove stored state')};
  const stop=installAppViewport(host,document);stop();viewport.height=300;viewport.emit('resize');
  assert.equal(values.get('--app-viewport-height'),'844px');
});

test('successive keyboard viewport updates keep only one reveal callback and cancel it when disposed',()=>{
  const {host,document,viewport}=environment(),pending=new Map();let next=0;
  host.requestAnimationFrame=fn=>{pending.set(++next,fn);return next;};host.cancelAnimationFrame=id=>pending.delete(id);
  const stop=installAppViewport(host,document);assert.equal(pending.size,1);
  viewport.height=500;viewport.emit('resize');viewport.height=400;viewport.emit('resize');
  assert.equal(pending.size,1);stop();assert.equal(pending.size,0);
});
