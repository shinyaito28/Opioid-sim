"""Independent linear-system reference using scipy.linalg.expm; never used by the app.
Only synthetic attributes. Same supplied PK parameters, not clinical validation.
"""
from pathlib import Path
import json
import numpy as np
from scipy.linalg import expm
root=Path(__file__).parent
cases=json.loads((root/'reference-input.json').read_text())
for case in cases:
 p=case['params'];v1,v2,v3=p['V1'],p['V2'],p['V3'];q2,q3=p['Q2'],p['Q3'];ke=p['ke0']
 a=np.zeros((5,5));a[0,:3]=[-(p['Cl']+q2+q3)/v1,q2/v2 if v2 else 0,q3/v3 if v3 else 0]
 a[1,:2]=[q2/v1,-q2/v2] if v2 else [0,0]
 a[2,[0,2]]=[q3/v1,-q3/v3] if v3 else [0,0]
 a[3,[0,3]]=[ke/v1,-ke];a[0,4]=1
 scale=1 if case['drug']=='Fentanyl' else 1000
 queue=[]
 for e in case['events']:
  if e['type']=='bolus':queue.append((e['time'],'bolus',e['id'],e['amount']*scale))
  else:queue += [(e['time'],'start',e['id'],e['rate']*scale/60),(e['time']+e['duration'],'stop',e['id'],0)]
 queue.sort(key=lambda e:e[0]);x=np.zeros(5);now=0;active={};index=0;points=[]
 def advance(target):
  global x,now
  x[4]=sum(active.values());x=expm(a*(target-now))@x;now=target
 for t in list(range(int(case['duration'])+1))+[case['duration']]:
  while index<len(queue) and queue[index][0]<=t:
   et,kind,eid,value=queue[index];advance(et)
   if kind=='bolus':x[0]+=value
   elif kind=='start':active[eid]=value
   else:active.pop(eid,None)
   index+=1
  advance(t);points.append({'time':t,'cp':float(x[0]/v1),'ce':float(x[3])})
 case['expected']=points
(root/'reference-fixtures.json').write_text(json.dumps({'method':'scipy.linalg.expm on augmented linear compartment equations, same PK parameters; synthetic only','cases':cases},indent=2))
print('Generated 12 independent 4-drug fixtures')
