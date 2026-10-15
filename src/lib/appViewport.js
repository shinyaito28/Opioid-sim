import {visibleViewport} from './viewport.js';

export function standaloneMode(host,media=host.matchMedia?.('(display-mode: standalone)')) {
  return media?.matches===true||host.navigator?.standalone===true;
}

export function appViewportFrame(host) {
  const viewport=host.visualViewport;
  // Pinch zoom must magnify the existing layout rather than shrink/reflow it.
  const zoomed=Number.isFinite(viewport?.scale)&&Math.abs(viewport.scale-1)>.01;
  return visibleViewport(zoomed?undefined:viewport,{width:host.innerWidth,height:host.innerHeight});
}

export function scrollApplicationBy(host,document,options) {
  const scroller=document.documentElement.dataset.standalone==='true'?document.querySelector('.simple-app'):null;
  if(scroller){scroller.scrollBy(options);return 'app';}
  host.scrollBy(options);return 'window';
}

export function revealInstalledInput(host,document) {
  if(document.documentElement.dataset.standalone!=='true')return false;
  const scroller=document.querySelector('.simple-app'),active=document.activeElement;
  if(!scroller?.contains(active)||!active.matches('input,select,textarea'))return false;
  const input=active.getBoundingClientRect(),bounds=scroller.getBoundingClientRect();
  const frame=appViewportFrame(host),bottom=Math.min(bounds.bottom,frame.top+frame.height)-12;
  const top=Math.max(bounds.top,frame.top)+12;
  const delta=input.bottom>bottom?input.bottom-bottom:input.top<top?input.top-top:0;
  if(delta){scroller.scrollBy({top:delta,behavior:'auto'});return true;}
  return false;
}

// Only installed apps use an inner scroller. Safari tabs and desktop retain
// document scrolling. No device/OS-version guesses or fixed notch heights.
export function installAppViewport(host,document) {
  const media=host.matchMedia?.('(display-mode: standalone)'),root=document.documentElement;
  const properties=['--app-viewport-left','--app-viewport-top','--app-viewport-width','--app-viewport-height'];
  let request=null;
  const update=()=>{
    const installed=standaloneMode(host,media);
    root.dataset.standalone=String(installed);
    if(installed){
      const frame=appViewportFrame(host);
      for(const [index,value] of [frame.left,frame.top,frame.width,frame.height].entries())root.style.setProperty(properties[index],value+'px');
    }else for(const name of properties)root.style.removeProperty(name);
    if(host.requestAnimationFrame){
      if(request!==null)host.cancelAnimationFrame(request);
      request=installed?host.requestAnimationFrame(()=>{request=null;revealInstalledInput(host,document);}):null;
    }
  };
  update();
  host.addEventListener('resize',update);
  host.visualViewport?.addEventListener('resize',update);host.visualViewport?.addEventListener('scroll',update);
  media?.addEventListener?.('change',update);
  return()=>{
    host.removeEventListener('resize',update);
    host.visualViewport?.removeEventListener('resize',update);host.visualViewport?.removeEventListener('scroll',update);
    media?.removeEventListener?.('change',update);
    if(request!==null)host.cancelAnimationFrame(request);
  };
}
