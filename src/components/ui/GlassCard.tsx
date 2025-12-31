import { ReactNode, MouseEvent } from 'react';

interface GlassCardProps {
    children: ReactNode;
    className?: string;
    onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export default function GlassCard({ children, className = '', onClick }: GlassCardProps) {
    return (
        <div
            onClick={onClick}
            className={`
      backdrop-blur-xl
      bg-white/70 dark:bg-slate-900/70
      border border-slate-200/50 dark:border-white/10
      shadow-2xl rounded-2xl
      ${className}
    `}>
            {children}
        </div>
    );
}
