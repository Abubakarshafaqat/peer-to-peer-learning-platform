import { cn } from '../../utils/cn.js';

export default function Card({ children, className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface p-6 shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
