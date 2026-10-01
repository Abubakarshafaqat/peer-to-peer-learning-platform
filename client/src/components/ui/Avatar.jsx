import { resolveAssetUrl } from '../../utils/assetUrl.js';
import { cn } from '../../utils/cn.js';

export default function Avatar({ user, size = 'md', className }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-20 w-20 text-2xl',
  };

  const initials = (user?.fullName || user?.username || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const src = resolveAssetUrl(user?.avatarUrl);

  if (src) {
    return (
      <img
        src={src}
        alt={user?.fullName || user?.username || 'Avatar'}
        className={cn('rounded-full object-cover ring-2 ring-line', sizes[size], className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ring-2 ring-line',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
