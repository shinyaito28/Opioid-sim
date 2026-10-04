import fs from 'node:fs';
import { getPKParameters } from '../src/lib/drugs.js';
const models={Fentanyl:'Bae (2020) Adult',Hydromorphone:'Jeleazcov (2014) Adult',Morphine:'Mazoit (2007) Adult',Propofol:'Eleveld (2018) General-purpose'};
const cases=[];
for(const [drug,model] of Object.entries(models))for(const patient of [
 {age:18,weight:35,height:150,gender:'female'},
 {age:35,weight:70,height:170,gender:'male'},
 {age:80,weight:100,height:180,gender:'female'},
]){
 const dose=drug==='Fentanyl'?100:drug==='Morphine'?5:drug==='Hydromorphone'?.5:100;
 cases.push({drug,model,patient,params:getPKParameters(drug,model,patient),duration:30.5,
  events:[{id:'a',drug,type:'bolus',time:0,amount:dose},
    {id:'b',drug,type:'infusion',time:2.5,rate:dose*2,duration:10.25,isInfinite:false},
    {id:'c',drug,type:'bolus',time:8.1,amount:dose/2},
    {id:'d',drug,type:'infusion',time:10.2,rate:dose,duration:5,isInfinite:false}]});
}
fs.writeFileSync(new URL('./reference-input.json',import.meta.url),JSON.stringify(cases,null,2));
