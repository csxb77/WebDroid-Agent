import { AlertTriangle, Check, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { AppCopy } from '../lib/appCopy'

export type UnrestrictedModeConfirmDialogProps = {
  copy: AppCopy
  onCancel: () => void
  onConfirm: () => void
}

export function UnrestrictedModeConfirmDialog({
  copy,
  onCancel,
  onConfirm,
}: UnrestrictedModeConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    // Default focus to cancel for destructive confirmation.
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="sensitive-action-dialog-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unrestricted-mode-confirm-title"
      onClick={onCancel}
    >
      <section
        className="sensitive-action-dialog-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sensitive-action-dialog-header">
          <span className="sensitive-action-dialog-icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <div>
            <p className="eyebrow">{copy.unrestrictedMode}</p>
            <h2 id="unrestricted-mode-confirm-title">
              {copy.unrestrictedModeEnableTitle}
            </h2>
          </div>
        </header>

        <p className="sensitive-action-dialog-message">
          {copy.unrestrictedModeEnablePrompt}
        </p>

        <div className="sensitive-action-dialog-actions">
          <button type="button" className="primary" onClick={onCancel} ref={confirmButtonRef}>
            <X size={16} />
            {copy.unrestrictedModeCancel}
          </button>
          <button type="button" onClick={onConfirm}>
            <Check size={16} />
            {copy.unrestrictedModeConfirm}
          </button>
        </div>
      </section>
    </div>
  )
}
