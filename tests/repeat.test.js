import test from 'node:test';
import assert from 'node:assert/strict';
import {createRepeater} from '../src/lib/repeat.js';
function fakeClock() {
  let now=0,id=0;const jobs=new Map();
  return {setTimeout(fn,ms){const key=++id;jobs.set(key,{fn,time:now+ms});return key;},
    setInterval(fn,ms){const key=++id;jobs.set(key,{fn,time:now+ms,interval:ms});return key;},
    clearTimeout(key){jobs.delete(key);},clearInterval(key){jobs.delete(key);},
    advance(ms){const end=now+ms;for(;;){const next=[...jobs].filter(([,v])=>v.time<=end).sort((a,b)=>a[1].time-b[1].time)[0];
      if(!next)break;const [key,job]=next;now=job.time;if(job.interval)job.time+=job.interval;else jobs.delete(key);job.fn();}now=end;},
    get pending(){return jobs.size;}};
}
test('tap adjusts once; release/cancel stop before repetition',()=>{
  const clock=fakeClock();let value=0;const hold=createRepeater(()=>value++,clock);
  hold.start();clock.advance(200);hold.stop();clock.advance(1000);
  assert.equal(value,1);assert.equal(clock.pending,0);
});
test('long press repeats after delay and stops immediately on every stop path',()=>{
  for(const reason of ['pointerup','pointercancel','lostpointercapture','blur','hidden','unmount']){
    const clock=fakeClock();let value=0;const hold=createRepeater(()=>value++,clock);
    hold.start();clock.advance(700);assert.equal(value,4,reason);hold.stop();
    clock.advance(5000);assert.equal(value,4,reason);assert.equal(clock.pending,0,reason);
  }
});
test('starting a new press cancels the previous timers',()=>{
  const clock=fakeClock();let value=0;const hold=createRepeater(()=>value++,clock);
  hold.start();clock.advance(450);hold.start();clock.advance(100);
  assert.equal(value,2);hold.stop();assert.equal(clock.pending,0);
});
