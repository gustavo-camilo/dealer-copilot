/**
 * One document-level pointer listener that feeds the `.spotlight` CSS effect
 * (--mx / --my on whichever spotlight element is under the pointer).
 * Returns a cleanup function.
 */
export function installSpotlight(): () => void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  let frame = 0;
  const onMove = (event: PointerEvent) => {
    const target = (event.target as Element | null)?.closest?.('.spotlight') as HTMLElement | null;
    if (!target) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      target.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('pointermove', onMove);
  };
}
