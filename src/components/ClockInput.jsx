import { useEffect, useRef, useState } from 'react';
import { clockToMinutes } from '../lib/clock.js';
import { clockParts, clockFields, validEntryMinute } from '../lib/simpleInput.js';
import { createRepeater } from '../lib/repeat.js';

export function RepeatButton({ onStep, disabled, label, children }) {
  const callback = useRef(onStep),controller=useRef(null);
  callback.current = onStep;
  if(!controller.current)controller.current=createRepeater(()=>callback.current());
  const stop = () => controller.current.stop();
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener('blur',stop); window.addEventListener('pointerup',stop);
    window.addEventListener('pointercancel',stop); document.addEventListener('visibilitychange',hide);
    return () => { stop(); window.removeEventListener('blur',stop); window.removeEventListener('pointerup',stop);
      window.removeEventListener('pointercancel',stop); document.removeEventListener('visibilitychange',hide); };
  },[]);
  useEffect(() => { if (disabled) stop(); },[disabled]);
  return <button type="button" className="step-button" aria-label={label} disabled={disabled}
    onPointerDown={e => { if (disabled || e.button !== 0) return; e.preventDefault(); stop();
      e.currentTarget.setPointerCapture?.(e.pointerId); controller.current.start(); }}
    onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
    onContextMenu={e=>e.preventDefault()} onClick={e=>{ if (e.detail===0 && !disabled) callback.current(); }}>
    {children}
  </button>;
}

export default function ClockInput({ minute, startTime, onChange, onPending, onNow, t }) {
  const parts = clockParts(minute,startTime);
  const [hour,setHour]=useState(parts.hour), [min,setMin]=useState(parts.minute);
  const latest=useRef(minute); latest.current=minute;
  useEffect(()=>{ const p=clockParts(minute,startTime); setHour(p.hour); setMin(p.minute); },[minute,startTime]);
  const edit=(h,m,blur=false)=>{
    setHour(h); setMin(m);
    const parsed=clockFields(h,m,blur);
    if(parsed.status!=='valid'){onPending(parsed.status==='invalid'?'invalid':true);return;}
    setHour(parsed.hour);setMin(parsed.minute);
    try { const value=clockToMinutes(parsed.hour+':'+parsed.minute,startTime,latest.current);
      if (!validEntryMinute(value)) throw new RangeError(); onPending(false); onChange(value);
    } catch { onPending('invalid'); }
  };
  const step=delta=>{ const value=latest.current+delta; if(validEntryMinute(value)){onPending(false);latest.current=value;onChange(value);} };
  const key=(e,delta)=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();step(e.key==='ArrowUp'?delta:-delta);}};
  return <div className="clock-block" data-testid="shared-clock">
    <span className="field-label">{t('simpleTime')}</span>
    <div className="clock-controls">
      <div className="clock-part">
        <RepeatButton onStep={()=>step(60)} label={t('simpleHourUp')}>＋</RepeatButton>
        <input aria-label={t('simpleHour')} data-testid="clock-hour" value={hour} inputMode="numeric" maxLength={2}
          onChange={e=>edit(e.target.value,min)} onKeyDown={e=>key(e,60)}
          onBlur={()=>edit(hour,min,true)}/>
        <RepeatButton onStep={()=>step(-60)} label={t('simpleHourDown')}>−</RepeatButton>
      </div>
      <span className="clock-colon" aria-hidden="true">:</span>
      <div className="clock-part">
        <RepeatButton onStep={()=>step(1)} label={t('simpleMinuteUp')}>＋</RepeatButton>
        <input aria-label={t('simpleMinute')} data-testid="clock-minute" value={min} inputMode="numeric" maxLength={2}
          onChange={e=>edit(hour,e.target.value)} onKeyDown={e=>key(e,1)}
          onBlur={()=>edit(hour,min,true)}/>
        <RepeatButton onStep={()=>step(-1)} label={t('simpleMinuteDown')}>−</RepeatButton>
      </div>
      <button type="button" className="quiet-button" onClick={()=>{
        const value=onNow();if(validEntryMinute(value)){const p=clockParts(value,startTime);
          setHour(p.hour);setMin(p.minute);latest.current=value;onPending(false);}
      }}>{t('now')}</button>
      {parts.day!==0&&<span className="day-offset">{parts.day>0?'+':''}{parts.day}d</span>}
    </div>
  </div>;
}
