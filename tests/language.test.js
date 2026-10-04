import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSavedLanguage, initialLanguage } from '../src/lib/language.js';
import { MAIN_DRUGS } from '../src/lib/workflow.js';
import fs from 'node:fs';
test('fresh or invalid language defaults to English independently of browser locale',()=>{
 for (const value of [null,undefined,'','de','invalid-language','null','{}',123]) assert.equal(resolveSavedLanguage(value),'en');
 assert.equal(initialLanguage({getItem:()=>null}),'en');
 assert.equal(initialLanguage({getItem:()=>{throw new Error('Storage unavailable')}}),'en');
});
test('explicit supported saved choices and regional variants retain their display language',()=>{
 for(const value of ['en','en-US','EN-gb'])assert.equal(resolveSavedLanguage(value),'en');
 for(const value of ['ja','ja-JP'])assert.equal(resolveSavedLanguage(value),'ja');
 assert.equal(initialLanguage({getItem:key=>key==='i18nextLng'?'ja':null}),'ja');
});
test('five frequent drugs and their new UI translations are complete in both languages',()=>{
 assert.deepEqual(MAIN_DRUGS,['Fentanyl','Hydromorphone','Morphine','Propofol','Remimazolam']);
 const en=JSON.parse(fs.readFileSync(new URL('../src/locales/en.json',import.meta.url)));
 const ja=JSON.parse(fs.readFileSync(new URL('../src/locales/ja.json',import.meta.url)));
 const uiKeys=[...new Set([...Object.keys(en),...Object.keys(ja)])].filter(key=>key.startsWith('entry'));
 for(const key of uiKeys){assert.equal(typeof en[key],'string',key);assert.equal(typeof ja[key],'string',key);assert(en[key].trim());assert(ja[key].trim());}
 assert.equal(en.entryDrugRemimazolam,'Remimazolam');assert.equal(ja.entryDrugRemimazolam,'レミマゾラム');
});
