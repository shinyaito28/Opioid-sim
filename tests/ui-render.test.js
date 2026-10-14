import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToString} from 'react-dom/server';
import i18next from 'i18next';
import {I18nextProvider,initReactI18next} from 'react-i18next';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';

let server,App;
const en=JSON.parse(fs.readFileSync(new URL('../src/locales/en.json',import.meta.url)));
const ja=JSON.parse(fs.readFileSync(new URL('../src/locales/ja.json',import.meta.url)));
before(async()=>{
  server=await createServer({configFile:false,plugins:[react()],server:{middlewareMode:true},appType:'custom'});
  App=(await server.ssrLoadModule('/src/App.jsx')).default;
});
after(async()=>{await server?.close();});
for(const language of ['en','ja'])test(language+': complete UI renders with one clock, common tabs, and no old status/preset controls',async()=>{
  const i18n=i18next.createInstance();
  await i18n.use(initReactI18next).init({lng:language,resources:{en:{translation:en},ja:{translation:ja}},interpolation:{escapeValue:false}});
  const html=renderToString(React.createElement(I18nextProvider,{i18n},React.createElement(App)));
  assert.equal((html.match(/data-testid="shared-clock"/g)||[]).length,1);
  assert.equal((html.match(/role="tab"/g)||[]).length,2);
  assert(html.includes('data-testid="dose-add"'));assert(html.includes('data-testid="simple-graph"'));
  assert(!html.includes('quick-status-'));assert(!html.includes('include-planned'));
  assert(!html.includes('For Research/Edu Only'));assert(!html.includes('6h</button>'));
  assert(!html.includes('12h</button>'));assert(!html.includes('24h</button>'));
  assert(!html.includes('simpleTime'));assert(!html.includes('simpleAddBolus'));
});
