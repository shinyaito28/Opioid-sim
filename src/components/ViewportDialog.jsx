import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {dialogBounds,visibleViewport,focusCycleIndex} from '../lib/viewport.js';

const readFrame=()=>typeof window==='undefined'?visibleViewport():visibleViewport(window.visualViewport,{width:window.innerWidth,height:window.innerHeight});

// A visual-viewport dialog with a fixed header and a separately scrolling body.
// The portal avoids header/filter stacking contexts. No input is focused on open.
export default function ViewportDialog({open,onClose,title,t,children,width=420,testId}) {
  const titleId=useId(),panel=useRef(null),backdrop=useRef(null),content=useRef(null),closeButton=useRef(null),close=useRef(onClose),backdropPress=useRef(false);
  close.current=onClose;
  const [layout,setLayout]=useState(()=>({frame:readFrame(),panel:dialogBounds(readFrame(),width)}));
  useEffect(()=>{
    if(!open)return;
    const body=document.body,root=document.getElementById('root'),previousFocus=document.activeElement,scrollX=window.scrollX,scrollY=window.scrollY;
    const previousInert=root?.inert,previousHidden=root?.getAttribute('aria-hidden');
    if(root){root.inert=true;root.setAttribute('aria-hidden','true');}
    const previous=Object.fromEntries(['overflow','position','top','left','width'].map(key=>[key,body.style[key]]));
    Object.assign(body.style,{overflow:'hidden',position:'fixed',top:-scrollY+'px',left:-scrollX+'px',width:'100%'});
    const place=()=>{
      const frame=readFrame(),padding=getComputedStyle(backdrop.current);
      const safe=Object.fromEntries(['top','right','bottom','left'].map(side=>[side,parseFloat(padding.getPropertyValue('padding-'+side))||0]));
      setLayout({frame,panel:dialogBounds(frame,width,safe)});
    };
    place();closeButton.current?.focus({preventScroll:true});
    const escape=event=>{if(event.key==='Escape'){event.preventDefault();close.current();}};
    window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);
    document.addEventListener('keydown',escape);
    return()=>{
      window.removeEventListener('resize',place);window.visualViewport?.removeEventListener('resize',place);window.visualViewport?.removeEventListener('scroll',place);
      document.removeEventListener('keydown',escape);Object.assign(body.style,previous);window.scrollTo(scrollX,scrollY);
      if(root){root.inert=previousInert;if(previousHidden===null)root.removeAttribute('aria-hidden');else root.setAttribute('aria-hidden',previousHidden);}
      if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    };
  },[open,width]);
  useEffect(()=>{
    if(!open)return;
    const active=document.activeElement;
    if(!content.current?.contains(active)||!active.matches('input,select'))return;
    const rect=active.getBoundingClientRect(),bounds=content.current.getBoundingClientRect();
    if(rect.bottom>bounds.bottom-12)content.current.scrollTop+=rect.bottom-bounds.bottom+12;
    else if(rect.top<bounds.top+12)content.current.scrollTop-=bounds.top+12-rect.top;
  },[open,layout]);
  if(!open)return null;
  const view=<div className="dialog-backdrop" ref={backdrop} style={{left:layout.frame.left,top:layout.frame.top,width:layout.frame.width,height:layout.frame.height}}
    onPointerDown={event=>{backdropPress.current=event.target===event.currentTarget;}} onPointerCancel={()=>{backdropPress.current=false;}}
    onClick={event=>{if(backdropPress.current&&event.target===event.currentTarget)close.current();}}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="viewport-dialog" style={layout.panel} data-testid={testId}
      onKeyDown={event=>{
        if(event.key!=='Tab')return;
        const targets=[...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],textarea:not(:disabled),[tabindex="0"]')]
          .filter(element=>element.getClientRects().length>0);
        const next=focusCycleIndex(targets.indexOf(document.activeElement),targets.length,event.shiftKey);
        if(next!==null){event.preventDefault();targets[next].focus();}
      }}>
      <div className="dialog-heading"><h2 id={titleId}>{title}</h2>
        <button ref={closeButton} type="button" className="dialog-close" aria-label={t('close')} onClick={()=>close.current()}><X aria-hidden="true" size={20}/></button></div>
      <div ref={content} className="dialog-content">{children}</div>
    </section>
  </div>;
  return typeof document==='undefined'?view:createPortal(view,document.body);
}
