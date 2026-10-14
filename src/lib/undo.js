export function createUndoHistory(initial, limit = 100) {
  let current = initial, past = [], future = [], lastGroup = null;
  return {
    get current() { return current; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    update(next,group = null) {
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      if (!group || group !== lastGroup) past = [...past,current].slice(-limit);
      current = next; future = []; lastGroup = group; return current;
    },
    endGroup() { lastGroup = null; },
    undo() {
      if (!past.length) return current;
      future = [current,...future]; current = past.at(-1); past = past.slice(0,-1); lastGroup=null; return current;
    },
    redo() {
      if (!future.length) return current;
      past = [...past,current]; current=future[0]; future=future.slice(1); lastGroup=null; return current;
    },
    reset(next) { current=next; past=[]; future=[]; lastGroup=null; return current; }
  };
}
