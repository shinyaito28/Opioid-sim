export function createRepeater(step,timers=globalThis) {
  let delay=null,repeat=null;
  const stop=()=>{timers.clearTimeout(delay);timers.clearInterval(repeat);delay=null;repeat=null;};
  return {stop,start(){stop();step();delay=timers.setTimeout(()=>{repeat=timers.setInterval(step,100);},400);}};
}
