import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover lift + pointer for clickable cards. */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md';
}

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6' };

export function Card({ interactive, padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'edge-light rounded-2xl border border-line bg-surface',
        paddings[padding],
        interactive &&
          'spotlight cursor-pointer transition-[transform,border-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-ink-subtle/40 active:translate-y-0',
        className
      )}
      {...props}
    />
  );
}

interface SectionHeaderProps {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {action}
    </div>
  );
}
