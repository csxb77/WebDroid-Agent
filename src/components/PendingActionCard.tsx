import { Check } from 'lucide-react'
import { buildActionPreview } from '../lib/actionPreview'
import type { AgentAction } from '../lib/actionTypes'
import type { AppCopy } from '../lib/appCopy'
import type { AgentStep } from '../lib/agent'
import type { BusyTask } from '../lib/busyTask'

type PendingActionCardProps = {
  busyTask: BusyTask | null
  copy: AppCopy
  onExecutePendingStep: () => void
  pendingStep: AgentStep
}

export function PendingActionCard({
  busyTask,
  copy,
  onExecutePendingStep,
  pendingStep,
}: PendingActionCardProps) {
  const actionLabel = pendingActionLabel(pendingStep.action.action, copy)

  return (
    <div className="pending-action">
      <div className="pending-header">
        <span>{copy.pendingAction}</span>
        <small>{copy.step} {pendingStep.index}</small>
      </div>
      <p>{buildActionPreview(pendingStep.action)}</p>
      <button
        type="button"
        className="wide primary"
        onClick={onExecutePendingStep}
        disabled={Boolean(busyTask)}
        title={busyTask ? copy.waitForCurrentRun : actionLabel}
      >
        <Check size={16} />
        {actionLabel}
      </button>
    </div>
  )
}

function pendingActionLabel(action: AgentAction['action'] | undefined, copy: AppCopy) {
  if (
    action === 'take_over' ||
    action === 'note' ||
    action === 'interact' ||
    action === 'call_api'
  ) {
    return copy.acknowledge
  }
  if (action === 'done') {
    return copy.finish
  }
  return copy.execute
}
