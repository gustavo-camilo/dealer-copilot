import type { ReactNode } from 'react';
import { RollingNumber } from './RollingNumber';
import { Card } from './Card';
import { cn } from './cn';

interface StatProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon?: ReactNode;
  hint?: ReactNode;
  className?: string;
}

/** KPI tile: small label, large animated number, optional hint line. */
export function Stat({ label, value, format, icon, hint, className }: StatProps) {
  return (
    <Card padding="sm" className={cn('flex flex-col gap-2 sm:p-5', className)}>
      <div className="flex items-center justify-between text-ink-muted">
        <span className="text-xs font-medium">{label}</span>
        {icon && <span className="text-ink-subtle [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      </div>
      <span className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        <RollingNumber value={value} format={format ?? ((n) => Math.round(n).toLocaleString('en-US'))} />
      </span>
      {hint && <div className="text-xs text-ink-subtle">{hint}</div>}
    </Card>
  );
}
