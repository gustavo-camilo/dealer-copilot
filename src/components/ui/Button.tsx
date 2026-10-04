import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold ' +
  'transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out-expo ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink shadow-[0_1px_0_0_rgb(255_255_255/0.2)_inset,0_8px_24px_-12px_rgb(var(--accent)/0.7)] hover:bg-accent-strong',
  secondary: 'border border-line bg-surface text-ink hover:border-ink-subtle/40 hover:bg-surface-2',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
  inverse: 'bg-ink text-canvas hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

function buttonClasses({ variant = 'primary', size = 'md', block }: StyleProps = {}) {
  return cn(base, variants[variant], sizes[size], block && 'w-full');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, block, loading, icon, className, children, disabled, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses({ variant, size, block }), className)}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

interface ButtonLinkProps extends LinkProps, StyleProps {
  icon?: ReactNode;
}

export function ButtonLink({ variant, size, block, icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses({ variant, size, block }), className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
