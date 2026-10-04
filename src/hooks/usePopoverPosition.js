import { useLayoutEffect, useState } from 'react';

// Measure the visible viewport (including keyboard resizing) and keep a
// floating form below the sticky header. The form can scroll independently.
export function usePopoverPosition({ open, panelRef, anchorRef, point, contentKey }) {
  const [style, setStyle] = useState({ visibility: 'hidden' });
  const x = point?.x;
  const y = point?.y;
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!panel || !anchor) return;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const gutter = 12;
      const panelWidth = Math.min(288, Math.max(0, width - gutter * 2));
      const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? viewportTop;
      const minTop = Math.max(viewportTop + gutter, headerBottom + 4);
      const bottom = viewportTop + height - gutter;
      const maxHeight = Math.max(40, bottom - minTop);
      const panelHeight = Math.min(panel.scrollHeight + 2, maxHeight);
      const rect = anchor.getBoundingClientRect();
      const targetX = rect.left + (x ?? 0);
      const targetY = y == null ? rect.bottom + 4 : rect.top + y;
      const left = Math.max(viewportLeft + gutter, Math.min(targetX - (x == null ? 0 : panelWidth / 2), viewportLeft + width - gutter - panelWidth));
      const above = y != null && targetY - panelHeight - 12 >= minTop;
      const targetTop = above ? targetY - panelHeight - 12 : targetY + (y == null ? 0 : 12);
      const top = Math.max(minTop, Math.min(targetTop, bottom - panelHeight));
      setStyle({ position: 'fixed', left, top, width: panelWidth, maxHeight, visibility: 'visible' });
    };
    place();
    const observer = new ResizeObserver(place);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open, panelRef, anchorRef, x, y, contentKey]);
  return style;
}
