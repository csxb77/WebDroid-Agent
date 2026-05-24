import type { AgentThread, AgentTurn } from './agentThread'
import type { AgentConversationMessage } from './openAiTypes'

export type InteractionStreamItem =
  | {
      type: 'message'
      id: string
      message: AgentConversationMessage
    }
  | {
      type: 'step'
      id: string
      turn: AgentTurn
    }

export function buildInteractionStream(thread: AgentThread): InteractionStreamItem[] {
  if (thread.events.length === 0 && thread.turns.length === 0) {
    return thread.messages.map(messageToItem)
  }

  const items: InteractionStreamItem[] = []
  const messagesById = new Map(thread.messages.map((message) => [message.id, message]))
  const turnsById = new Map(thread.turns.map((turn) => [turn.id, turn]))
  const mirroredObservationResults = new Set(
    thread.turns
      .map((turn) => turn.executionResult?.trim())
      .filter((result): result is string => Boolean(result)),
  )
  const seenMessageIds = new Set<string>()
  const seenTurnIds = new Set<string>()

  const pushMessage = (message: AgentConversationMessage) => {
    if (seenMessageIds.has(message.id)) {
      return
    }
    items.push(messageToItem(message))
    seenMessageIds.add(message.id)
  }

  const pushStep = (turn: AgentTurn) => {
    if (seenTurnIds.has(turn.id)) {
      return
    }
    items.push({
      type: 'step',
      id: `step-${turn.id}`,
      turn,
    })
    seenTurnIds.add(turn.id)
  }

  for (const event of thread.events) {
    if (event.type === 'user_message') {
      pushMessage(
        messagesById.get(event.messageId) ?? {
          id: event.messageId,
          role: 'user',
          content: event.message,
        },
      )
      continue
    }

    if (event.type === 'assistant_action') {
      const turn = turnsById.get(event.turnId)
      if (turn) {
        pushStep(turn)
      }
      continue
    }

    if (event.type === 'assistant_message') {
      pushMessage(
        messagesById.get(event.messageId) ?? {
          id: event.messageId,
          role: 'assistant',
          content: event.message,
        },
      )
    }
  }

  for (const message of thread.messages) {
    if (message.role === 'user') {
      pushMessage(message)
    }
  }

  for (const turn of thread.turns) {
    pushStep(turn)
  }

  for (const message of thread.messages) {
    if (message.role === 'observation' && mirroredObservationResults.has(message.content.trim())) {
      continue
    }
    pushMessage(message)
  }

  return items
}

function messageToItem(message: AgentConversationMessage): InteractionStreamItem {
  return {
    type: 'message',
    id: `message-${message.id}`,
    message,
  }
}
