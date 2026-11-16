import React from 'react';
import { Inbox } from 'lucide-react';

export const KAVIRO_LOGO_SRC = '/assets/aistudio/file_000000002dbc82108f86130fa3c28c94_3eb2cade.png';

interface LogoProps {
  variant?: 'full' | 'compact';
  className?: string;
}

/**
 * Preserves the exact proportions and colors of the official attached KAVIRO logo.
 * Uses a dark midnight-navy framing container on light backgrounds so the electric blue
 * mark and crisp white wordmark maintain clear contrast without distortion or cropping.
 */
export const KaviroLogo: React.FC<LogoProps> = ({ variant = 'full', className = '' }) => {
  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-2.5 shrink-0 select-none ${className}`}
      >
        <div className="h-9 w-14 rounded-lg bg-[#02050d] border border-blue-500/25 p-1 flex items-center justify-center overflow-hidden shrink-0">
          <img
            src={KAVIRO_LOGO_SRC}
            alt="KAVIRO Logo"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
          />
        </div>
        <span className="font-display font-bold tracking-wider text-base text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          KAVIRO
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl bg-[#02050d] border border-blue-500/25 px-3 py-2 flex items-center justify-center shrink-0 select-none ${className}`}
    >
      <img
        src={KAVIRO_LOGO_SRC}
        alt="KAVIRO Official Brand Mark"
        referrerPolicy="no-referrer"
        className="w-full h-auto max-h-20 object-contain"
      />
    </div>
  );
};

export const SurfaceCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}> = ({ children, className = '', elevated = false }) => (
  <div
    className={`rounded-xl border border-slate-200 dark:border-blue-500/20 ${
      elevated
        ? 'bg-slate-50 dark:bg-[#0e1934]'
        : 'bg-white dark:bg-[#091124]'
    } transition-colors duration-150 ${className}`}
  >
    {children}
  </div>
);

export const PrimaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }
> = ({ children, className = '', size = 'md', ...props }) => (
  <button
    {...props}
    className={`kaviro-gradient-btn text-white font-medium rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] cursor-pointer ${
      size === 'sm' ? 'px-3.5 py-2 text-xs' : 'px-5 py-2.5 text-sm'
    } ${className}`}
  >
    {children}
  </button>
);

export const SecondaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }
> = ({ children, className = '', size = 'md', ...props }) => (
  <button
    {...props}
    className={`bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-[#0e1934] dark:hover:bg-[#142347] dark:text-slate-100 border border-slate-300 dark:border-blue-500/25 font-medium rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D7AFC] cursor-pointer ${
      size === 'sm' ? 'px-3.5 py-2 text-xs' : 'px-4 py-2.5 text-sm'
    } ${className}`}
  >
    {children}
  </button>
);

export const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200 dark:border-blue-500/15">
    <div className="min-w-0">
      <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          {subtitle}
        </p>
      )}
    </div>
    {action && <div className="flex items-center gap-2.5 shrink-0">{action}</div>}
  </div>
);

export const MetricTile: React.FC<{
  label: string;
  value: string | number;
  context?: string;
  tone?: 'default' | 'accent' | 'warning' | 'danger' | 'success';
}> = ({ label, value, context, tone = 'default' }) => {
  const valueColor =
    tone === 'accent'
      ? 'text-[#1D7AFC] dark:text-[#00D4FF]'
      : tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'danger'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-900 dark:text-white';

  return (
    <SurfaceCard className="p-5">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl sm:text-3xl font-display font-bold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {context && (
        <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
          {context}
        </div>
      )}
    </SurfaceCard>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
    <div className="h-11 w-11 rounded-xl bg-slate-100 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20 flex items-center justify-center text-slate-500 dark:text-cyan-400">
      <Inbox className="w-5 h-5" />
    </div>
    <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="h-10 rounded-lg bg-slate-100 dark:bg-[#0e1934] animate-pulse"
      />
    ))}
  </div>
);
