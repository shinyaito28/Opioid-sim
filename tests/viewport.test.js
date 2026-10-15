import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleViewport,dialogBounds,focusCycleIndex} from '../src/lib/viewport.js';

for(const width of [320,375,390,430])test(width+'px: saved case and patient dialogs fit independently of a wrapped header trigger',()=>{
  const frame=visibleViewport({width,height:700,offsetLeft:0,offsetTop:0});
  for(const preferred of [380,460,600]){
    const panel=dialogBounds(frame,preferred);
    assert(panel.left>=12);assert(panel.left+panel.width<=width-12);
    assert.equal(panel.top,12);assert.equal(panel.maxHeight,676);
  }
});

test('keyboard-sized visible viewport, safe areas and pan offsets constrain the entire dialog',()=>{
  const frame=visibleViewport({width:375,height:280,offsetLeft:20,offsetTop:190});
  const panel=dialogBounds(frame,460,{top:44,bottom:34,left:0,right:0});
  assert.deepEqual(panel,{left:32,top:234,width:351,maxHeight:202});
  assert(panel.top+panel.maxHeight<=frame.top+frame.height-34);
  assert(panel.maxHeight>64+44); // Fixed heading/close control plus independently scrollable content.
});

test('desktop dialogs retain a readable maximum width and fallback without VisualViewport',()=>{
  const frame=visibleViewport(undefined,{width:1440,height:900}),panel=dialogBounds(frame,460);
  assert.equal(panel.width,460);assert.equal(panel.left,490);
  assert.deepEqual(visibleViewport({width:NaN,height:0,offsetTop:-1},{width:320,height:568}),{left:0,top:0,width:320,height:568});
});

test('keyboard focus cycles at both dialog boundaries, including a close-only dialog',()=>{
  assert.equal(focusCycleIndex(0,4,true),3);assert.equal(focusCycleIndex(3,4),0);
  assert.equal(focusCycleIndex(1,4),null);assert.equal(focusCycleIndex(2,4,true),null);
  assert.equal(focusCycleIndex(-1,4),0);assert.equal(focusCycleIndex(-1,4,true),3);
  assert.equal(focusCycleIndex(0,1),0);assert.equal(focusCycleIndex(0,1,true),0);assert.equal(focusCycleIndex(0,0),null);
});
