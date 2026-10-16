import {caseFingerprint,validateSimpleSnapshot} from './simpleStorage.js';

// New Case never overwrites a named case. Persist the returned snapshot before
// adopting it in the UI, so a full browser store leaves the current case intact.
export function newCaseWithArchive(current,fresh,{id,name,timestamp}) {
  const checked=validateSimpleSnapshot(current);
  const {savedScenarios=[],savedTraces=[],...data}=checked;
  const alreadySaved=savedScenarios.some(item=>{
    try{return caseFingerprint(validateSimpleSnapshot(item.data))===caseFingerprint(checked);}catch{return false;}
  });
  const library=alreadySaved?savedScenarios:[{id,name,timestamp,data},...savedScenarios];
  return validateSimpleSnapshot({...fresh,savedScenarios:library,savedTraces});
}
