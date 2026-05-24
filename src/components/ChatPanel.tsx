import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Hand,
  LoaderCircle,
  MessageSquare,
  Search,
  Send,
  SquarePen,
  Square,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { AgentTurn } from '../lib/agentThread'
import type { AppCopy } from '../lib/appCopy'
import type { BusyTask } from '../lib/busyTask'
import type { InteractionStreamItem } from '../lib/interactionStream'
import type { AgentConversationMessage } from '../lib/openAiTypes'
import type { AgentThreadSummary } from '../lib/threadStore'
import { MarkdownContent } from './MarkdownContent'

type ChatPanelProps = {
  activeThreadId: string
  busyTask: BusyTask | null
  chatInput: string
  conversation: AgentConversationMessage[]
  interactionItems?: InteractionStreamItem[]
  copy: AppCopy
  historySidebarOpen: boolean
  threadSummaries: AgentThreadSummary[]
  onChatInputChange: (value: string) => void
  onCloseHistorySidebar: () => void
  onDeleteThread: (threadId: string) => void
  onSelectThread: (threadId: string) => void
  onStartNewChat: () => void
  onStopRun: () => void
  onSubmitChatMessage: () => void
  onToggleHistorySidebar: () => void
}

export function ChatPanel({
  activeThreadId,
  busyTask,
  chatInput,
  conversation,
  interactionItems,
  copy,
  historySidebarOpen,
  threadSummaries,
  onChatInputChange,
  onCloseHistorySidebar,
  onDeleteThread,
  onSelectThread,
  onStartNewChat,
  onStopRun,
  onSubmitChatMessage,
  onToggleHistorySidebar,
}: ChatPanelProps) {
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null)
  const chatIsEmpty = chatInput.trim().length === 0
  const isBusy = Boolean(busyTask)
  const canStopRun = busyTask?.id === 'run-agent'
  const items =
    interactionItems ?? conversation.map<InteractionStreamItem>((message) => messageToItem(message))
  const activeStepId = isAgentStepBusyTask(busyTask) ? findLatestOpenStepId(items) : null
  const submitChatIfNotEmpty = () => {
    if (!chatIsEmpty) {
      onSubmitChatMessage()
    }
  }
  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    submitChatIfNotEmpty()
  }
  const handleStartNewChat = () => {
    onStartNewChat()
    chatInputRef.current?.focus()
  }
  const handleHistoryNewChat = () => {
    handleStartNewChat()
    onCloseHistorySidebar()
  }
  const focusComposerShell = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (target instanceof Element && target.closest('button, textarea, input, label')) {
      return
    }

    chatInputRef.current?.focus()
  }

  return (
    <section className="chat-shell" aria-label={copy.chat}>
      {historySidebarOpen ? (
        <button
          type="button"
          className="chat-history-backdrop"
          aria-label={copy.closeHistorySidebar}
          onClick={onCloseHistorySidebar}
        />
      ) : null}
      <ChatHistorySidebar
        activeThreadId={activeThreadId}
        busyTask={busyTask}
        copy={copy}
        isOpen={historySidebarOpen}
        onClose={onCloseHistorySidebar}
        onDeleteThread={onDeleteThread}
        onNewChat={handleHistoryNewChat}
        onSelectThread={onSelectThread}
        threadSummaries={threadSummaries}
      />
      <div className="panel-title run-panel-title chat-shell-header">
        <div className="panel-title-main">
          <button
            type="button"
            className="icon-button chat-history-toggle"
            aria-expanded={historySidebarOpen}
            aria-label={historySidebarOpen ? copy.closeHistorySidebar : copy.openHistorySidebar}
            title={historySidebarOpen ? copy.closeHistorySidebar : copy.openHistorySidebar}
            onClick={onToggleHistorySidebar}
          >
            <IconSidebarToggle size={20} strokeWidth={2} />
          </button>
          <MessageSquare size={18} />
          <h2>{copy.chat}</h2>
        </div>
        <button
          type="button"
          className="panel-title-action"
          onClick={handleStartNewChat}
          disabled={isBusy}
          title={busyTask ? copy.waitForCurrentRun : copy.newChat}
        >
          <SquarePen size={16} strokeWidth={2} />
          {copy.newChat}
        </button>
      </div>
      <div className="chat-stream" aria-label={copy.conversation}>
        {items.map((item) =>
          item.type === 'step' ? (
            <AgentStepCard
              copy={copy}
              isActive={item.turn.id === activeStepId}
              key={item.id}
              turn={item.turn}
            />
          ) : (
            <article className={`chat-message ${item.message.role}`} key={item.id}>
              <span className="visually-hidden">
                {formatConversationRole(item.message.role, copy)}
              </span>
              <MarkdownContent className="chat-message-content" content={item.message.content} />
            </article>
          ),
        )}
      </div>
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault()
          submitChatIfNotEmpty()
        }}
      >
        <div className="chat-input-frame" onClick={focusComposerShell}>
          <label className="chat-input-label">
            <span className="visually-hidden">{copy.chatMessage}</span>
            <textarea
              ref={chatInputRef}
              className="chat-input"
              value={chatInput}
              onChange={(event) => onChatInputChange(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={1}
              placeholder={copy.chatPlaceholder}
            />
          </label>
          <div className="chat-input-actions">
            <span className="chat-input-action-spacer" aria-hidden="true" />
            {canStopRun ? (
              <button
                type="button"
                className="chat-send chat-stop"
                onClick={onStopRun}
                title={copy.stopRun}
                aria-label={copy.stopRun}
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                className="chat-send primary"
                disabled={chatIsEmpty}
                title={chatIsEmpty ? copy.typeMessageFirst : copy.send}
                aria-label={copy.send}
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  )
}

function ChatHistorySidebar({
  activeThreadId,
  busyTask,
  copy,
  isOpen,
  onClose,
  onDeleteThread,
  onNewChat,
  onSelectThread,
  threadSummaries,
}: {
  activeThreadId: string
  busyTask: BusyTask | null
  copy: AppCopy
  isOpen: boolean
  onClose: () => void
  onDeleteThread: (threadId: string) => void
  onNewChat: () => void
  onSelectThread: (threadId: string) => void
  threadSummaries: AgentThreadSummary[]
}) {
  const [query, setQuery] = useState('')
  const isBusy = Boolean(busyTask)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredSummaries = useMemo(() => {
    if (!normalizedQuery) {
      return threadSummaries
    }
    return threadSummaries.filter((summary) => {
      return [summary.title, summary.task]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    })
  }, [normalizedQuery, threadSummaries])
  const emptyLabel = threadSummaries.length === 0 ? copy.historyEmpty : copy.historyNoMatches

  return (
    <aside
      className={`chat-history-sidebar ${isOpen ? 'open' : ''}`}
      aria-hidden={!isOpen}
      aria-label={copy.history}
      inert={isOpen ? undefined : true}
      role="complementary"
    >
      <div className="chat-history-header">
        <button
          type="button"
          className="icon-button chat-history-close"
          aria-label={copy.closeHistorySidebar}
          title={copy.closeHistorySidebar}
          onClick={onClose}
        >
          <IconSidebarToggle size={20} strokeWidth={2} />
        </button>
        <span>{copy.history}</span>
      </div>

      <div className="chat-history-actions">
        <button
          type="button"
          className="chat-history-action"
          disabled={isBusy}
          onClick={onNewChat}
          title={isBusy ? copy.waitForCurrentRun : copy.newChat}
        >
          <SquarePen size={18} strokeWidth={2} />
          <span>{copy.newChat}</span>
        </button>

        <label className="chat-history-search">
          <Search size={17} />
          <span className="visually-hidden">{copy.historySearchAria}</span>
          <input
            aria-label={copy.historySearchAria}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.historySearchPlaceholder}
          />
          {query ? (
            <button
              type="button"
              aria-label={copy.historySearchClear}
              title={copy.historySearchClear}
              onClick={() => setQuery('')}
            >
              <X size={14} />
            </button>
          ) : null}
        </label>
      </div>

      <div className="chat-history-list">
        {filteredSummaries.length === 0 ? (
          <p className="chat-history-empty">{emptyLabel}</p>
        ) : (
          <section aria-label={copy.recentChats}>
            <h3>{copy.recentChats}</h3>
            <div className="chat-history-items">
              {filteredSummaries.map((summary) => {
                const isActive = summary.id === activeThreadId
                return (
                  <div
                    className={`chat-history-item-row ${isActive ? 'active' : ''}`}
                    key={summary.id}
                  >
                    <button
                      type="button"
                      className="chat-history-item"
                      disabled={isBusy}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={copy.openHistoryThread(summary.title)}
                      onClick={() => onSelectThread(summary.id)}
                      title={isBusy ? copy.waitForCurrentRun : summary.title}
                    >
                      <span className="chat-history-item-title">{summary.title}</span>
                      <span className="chat-history-item-meta">
                        {formatHistoryTimestamp(summary.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="chat-history-delete"
                      disabled={isBusy}
                      aria-label={copy.deleteHistoryThread(summary.title)}
                      title={isBusy ? copy.waitForCurrentRun : copy.deleteHistoryThread(summary.title)}
                      onClick={() => onDeleteThread(summary.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}

type StepTone = 'planned' | 'running' | 'success' | 'failed' | 'review' | 'takeover'

function IconSidebarToggle({
  size,
  strokeWidth,
}: {
  size: number
  strokeWidth: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      aria-hidden="true"
    >
      <line x1="4" x2="20" y1="8" y2="8" />
      <line x1="4" x2="14" y1="16" y2="16" />
    </svg>
  )
}

function AgentStepCard({
  copy,
  isActive,
  turn,
}: {
  copy: AppCopy
  isActive: boolean
  turn: AgentTurn
}) {
  const status = formatStepStatus(turn, copy, isActive)
  const packageName = turn.deviceSnapshot.deviceState.packageName
  const result = formatStepResult(turn, copy)
  const stepSummary = formatStepSummary(turn)

  return (
    <article className={`agent-step-card ${status.tone}`} aria-label={`${copy.step} ${turn.index}`}>
      <div className="agent-step-header">
        <div className="agent-step-heading">
          <StepStatusIcon tone={status.tone} />
          <span>
            {copy.step} {turn.index}
          </span>
        </div>
        <span className={`agent-step-status ${status.tone}`}>{status.label}</span>
      </div>

      <MarkdownContent className="agent-step-summary" content={stepSummary} />

      <details className="agent-step-details">
        <summary>{copy.stepDetails}</summary>
        <div className="agent-step-details-grid">
          <span>{copy.stepTiming(turn.timing.totalMs)}</span>
          <span>
            {copy.currentApp}: {turn.deviceSnapshot.currentApp}
          </span>
          {packageName ? <span>{packageName}</span> : null}
        </div>
        <span className="agent-step-detail-title">{copy.stepAction}</span>
        <pre>{turn.preview}</pre>
        <span className="agent-step-detail-title">{copy.stepResult}</span>
        <pre className={result.isPending ? 'pending' : undefined}>{result.text}</pre>
        {turn.modelOutput.trim() ? (
          <>
            <span className="agent-step-detail-title">{copy.stepModelOutput}</span>
            <pre>{turn.modelOutput}</pre>
          </>
        ) : null}
      </details>
    </article>
  )
}

function StepStatusIcon({ tone }: { tone: StepTone }) {
  if (tone === 'success') {
    return <CheckCircle2 size={16} />
  }
  if (tone === 'failed') {
    return <XCircle size={16} />
  }
  if (tone === 'review') {
    return <AlertTriangle size={16} />
  }
  if (tone === 'takeover') {
    return <Hand size={16} />
  }
  if (tone === 'running') {
    return <LoaderCircle className="agent-step-spinner" size={16} />
  }
  return <CircleDashed size={16} />
}

function formatStepStatus(turn: AgentTurn, copy: AppCopy, isActive: boolean) {
  if (turn.status === 'planned') {
    return isActive
      ? { label: copy.stepStatusRunning, tone: 'running' as const }
      : { label: copy.stepStatusPlanned, tone: 'planned' as const }
  }
  if (turn.status === 'failed') {
    return { label: copy.stepStatusFailed, tone: 'failed' as const }
  }
  if (turn.status === 'done') {
    return { label: copy.stepStatusDone, tone: 'success' as const }
  }
  if (turn.status === 'awaiting_review') {
    return { label: copy.stepStatusAwaitingReview, tone: 'review' as const }
  }
  if (turn.status === 'awaiting_takeover') {
    return { label: copy.stepStatusTakeover, tone: 'takeover' as const }
  }
  return { label: copy.stepStatusExecuted, tone: 'success' as const }
}

function formatStepResult(turn: AgentTurn, copy: AppCopy) {
  if (turn.executionResult?.trim()) {
    return { text: turn.executionResult, isPending: false }
  }
  if (turn.status === 'done') {
    return { text: copy.taskComplete, isPending: false }
  }
  if (turn.status === 'awaiting_takeover' && turn.action.action === 'take_over') {
    return { text: turn.action.reason ?? turn.action.message, isPending: false }
  }
  return { text: copy.stepNoResult, isPending: true }
}

function formatStepSummary(turn: AgentTurn) {
  if ('reason' in turn.action && turn.action.reason?.trim()) {
    return turn.action.reason.trim()
  }

  if (turn.action.action === 'done') {
    return turn.action.summary?.trim() || stripPreviewPrefix(turn.preview)
  }
  if (
    turn.action.action === 'take_over' ||
    turn.action.action === 'note' ||
    turn.action.action === 'interact'
  ) {
    return turn.action.message.trim()
  }
  if (turn.action.action === 'call_api') {
    return turn.action.instruction.trim()
  }
  if (turn.action.action === 'input_text') {
    return turn.action.text.trim()
  }

  return stripPreviewPrefix(turn.preview)
}

function stripPreviewPrefix(preview: string) {
  const separatorIndex = preview.lastIndexOf(' - ')
  if (separatorIndex >= 0) {
    return preview.slice(separatorIndex + 3).trim()
  }
  return preview.trim()
}

function findLatestOpenStepId(items: readonly InteractionStreamItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item.type === 'step' && !item.turn.completedAt) {
      return item.turn.id
    }
  }
  return null
}

function isAgentStepBusyTask(busyTask: BusyTask | null) {
  return busyTask?.id === 'execute-action' || busyTask?.id === 'run-agent'
}

function messageToItem(message: AgentConversationMessage): InteractionStreamItem {
  return {
    type: 'message',
    id: `message-${message.id}`,
    message,
  }
}

function formatConversationRole(role: 'user' | 'assistant' | 'observation', copy: AppCopy) {
  if (role === 'assistant') {
    return copy.assistant
  }
  if (role === 'observation') {
    return copy.observation
  }
  return copy.user
}

function formatHistoryTimestamp(timestamp: number) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
