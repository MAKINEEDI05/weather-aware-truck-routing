export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'inverse' | 'outline-dark'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Actions use the iris accent, never a risk or route colour.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-strong disabled:bg-accent/40 disabled:hover:bg-accent/40',
  secondary:
    'border border-line-strong bg-surface text-ink hover:bg-paper disabled:text-ink-3 disabled:hover:bg-surface',
  ghost: 'text-ink hover:bg-paper-2 disabled:text-ink-3',
  inverse: 'bg-white text-ink hover:bg-paper',
  'outline-dark': 'border border-asphalt-3 text-white hover:bg-asphalt-2',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-md px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-md px-4 text-sm',
  lg: 'h-12 gap-2 rounded-md px-5 text-[15px]',
}

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
): string {
  return [
    'inline-flex shrink-0 items-center justify-center font-semibold transition-colors',
    'disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(' ')
}
