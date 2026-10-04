import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from './cn';

interface SheetProps {
  open: boolean;
  /** Called on backdrop click, Escape, close button, or swipe-down. The parent decides whether to actually close. */
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Max width on tablet/desktop where the sheet becomes a centered dialog. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Extra classes for the scrollable body. */
  bodyClassName?: string;
}

const widths = { sm: 'md:max-w-md', md: 'md:max-w-xl', lg: 'md:max-w-3xl', xl: 'md:max-w-4xl' };

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

/**
 * Bottom sheet on phones (swipe down to dismiss), centered dialog from md up.
 */
export function Sheet({ open, onClose, title, children, size = 'lg', bodyClassName }: SheetProps) {
  const desktop = useIsDesktop();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-canvas outline-none',
              'rounded-t-3xl shadow-[0_-12px_48px_-12px_rgb(0_0_0/0.45)] md:rounded-3xl md:shadow-2xl',
              widths[size]
            )}
            initial={desktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.98, y: 4 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 380, mass: 0.9 }}
            drag={desktop ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            {/* Only the handle + header start a swipe, so the body can scroll freely. */}
            <div
              className={cn(!desktop && 'touch-none')}
              onPointerDown={(e) => !desktop && dragControls.start(e)}
            >
            {!desktop && (
              <div className="flex justify-center pb-1 pt-2.5" aria-hidden>
                <span className="h-1.5 w-10 rounded-full bg-line" />
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 md:py-4">
              <h2 id={titleId} className="truncate text-base font-semibold tracking-tight text-ink md:text-lg">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="-mr-2 rounded-full p-2 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            </div>
            <div className={cn('flex-1 overflow-y-auto overscroll-contain pb-safe', bodyClassName)}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
