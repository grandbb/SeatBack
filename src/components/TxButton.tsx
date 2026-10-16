/**
 * A primary CTA button that shows wallet-confirmation → confirming → success/error states.
 * Wraps wagmi's isPending/isConfirming/isSuccess/isError cleanly.
 */
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface TxButtonProps {
  onClick: () => void
  isPending: boolean
  isConfirming: boolean
  isSuccess?: boolean
  isError?: boolean
  disabled?: boolean
  label: string
  pendingLabel?: string
  confirmingLabel?: string
  successLabel?: string
  variant?: 'primary' | 'danger' | 'ghost'
  className?: string
}

export function TxButton({
  onClick,
  isPending,
  isConfirming,
  isSuccess,
  isError,
  disabled,
  label,
  pendingLabel = 'Confirm in wallet…',
  confirmingLabel = 'Confirming…',
  successLabel = 'Done',
  variant = 'primary',
  className = '',
}: TxButtonProps) {
  const isLoading = isPending || isConfirming
  const isDisabled = isLoading || disabled

  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white',
    danger: 'bg-[var(--danger)] hover:bg-rose-700 text-white',
    ghost: 'bg-transparent border border-[var(--border-strong)] text-[var(--ink)] hover:bg-[var(--surface-muted)]',
  }

  const currentLabel = isPending
    ? pendingLabel
    : isConfirming
      ? confirmingLabel
      : isSuccess
        ? successLabel
        : label

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${base} ${variants[variant]} ${className}`}
      aria-busy={isLoading}
    >
      {isPending || isConfirming ? (
        <Loader2 size={16} className="animate-spin" />
      ) : isSuccess ? (
        <CheckCircle2 size={16} />
      ) : isError ? (
        <AlertCircle size={16} />
      ) : null}
      {currentLabel}
    </button>
  )
}
