import { cn } from '../../utils/cn.js';

const variants = {
  primary:
    'bg-primary text-white hover:bg-primary-hover shadow-sm focus-visible:ring-primary',
  accent:
    'bg-accent text-ink hover:bg-accent-deep focus-visible:ring-accent',
  ghost:
    'bg-transparent text-ink hover:bg-line/60 focus-visible:ring-primary',
  outline:
    'border border-line bg-surface text-ink hover:border-primary/40 focus-visible:ring-primary',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
