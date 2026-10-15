export function visibleViewport(viewport,fallback={width:1024,height:768}) {
  const positive=(value,other)=>Number.isFinite(value)&&value>0?value:other;
  const offset=value=>Number.isFinite(value)&&value>=0?value:0;
  return {left:offset(viewport?.offsetLeft),top:offset(viewport?.offsetTop),
    width:positive(viewport?.width,positive(fallback.width,1024)),height:positive(viewport?.height,positive(fallback.height,768))};
}

// Independent of the trigger's position: header wrapping cannot move a dialog offscreen.
export function dialogBounds(frame,preferredWidth,safe={}) {
  const gap=side=>Math.max(12,Number.isFinite(safe[side])?safe[side]:0);
  const width=Math.max(0,Math.min(preferredWidth,frame.width-gap('left')-gap('right')));
  return {left:frame.left+gap('left')+Math.max(0,(frame.width-gap('left')-gap('right')-width)/2),
    top:frame.top+gap('top'),width,maxHeight:Math.max(0,frame.height-gap('top')-gap('bottom'))};
}

export function focusCycleIndex(index,length,backward=false) {
  if(!length)return null;
  if(index<0)return backward?length-1:0;
  if(backward&&index===0)return length-1;
  if(!backward&&index===length-1)return 0;
  return null;
}
