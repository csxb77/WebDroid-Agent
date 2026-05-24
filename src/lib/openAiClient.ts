import { buildChatCompletionPayload, buildFinalResponsePayload } from './openAiPayload'
import {
  extractAssistantText,
  formatApiError,
  readJsonOrUndefined,
  readStreamingAssistantText,
} from './openAiResponse'
import { OpenAiClientError } from './openAiErrors'
import type {
  ChatCompletionPayload,
  FinalResponseRequest,
  CompletionRequest,
  OpenAiClient,
  RepairActionRequest,
} from './openAiTypes'

export { buildChatCompletionPayload } from './openAiPayload'
export { OpenAiClientError } from './openAiErrors'
export { extractAssistantText } from './openAiResponse'
export {
  type AgentConversationMessage,
  type AgentHistoryItem,
  type ChatCompletionPayload,
  type ChatMessage,
  type CompletionRequest,
  type FinalResponseRequest,
  type ModelConfig,
  type OpenAiClient,
  type RepairActionRequest,
  type UserContent,
} from './openAiTypes'

export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '')
}

export type OpenAiClientOptions = {
  proxyUrl?: string
}

export function createOpenAiClient(
  fetcher: typeof fetch = fetch,
  options: OpenAiClientOptions = {},
): OpenAiClient {
  async function completePayload(
    request: Pick<CompletionRequest, 'baseUrl' | 'apiKey' | 'stream' | 'signal'>,
    payload: ChatCompletionPayload,
  ) {
    const proxyUrl = options.proxyUrl?.trim()
    const url = proxyUrl || `${normalizeBaseUrl(request.baseUrl)}/chat/completions`
    const response = await fetcher(url, {
      method: 'POST',
      headers: proxyUrl
        ? {
            'Content-Type': 'application/json',
          }
        : {
            Authorization: `Bearer ${request.apiKey}`,
            'Content-Type': 'application/json',
          },
      signal: request.signal,
      body: JSON.stringify(
        proxyUrl
          ? {
              baseUrl: request.baseUrl,
              apiKey: request.apiKey,
              payload,
            }
          : payload,
      ),
    })

    if (request.stream) {
      if (!response.ok) {
        const body = await readJsonOrUndefined(response)
        throw new OpenAiClientError(formatApiError(response.status, body))
      }
      return readStreamingAssistantText(response)
    }

    const body = await readJsonOrUndefined(response)

    if (!response.ok) {
      throw new OpenAiClientError(formatApiError(response.status, body))
    }

    return extractAssistantText(body)
  }

  async function completeAction(request: CompletionRequest) {
    return completePayload(request, buildChatCompletionPayload(request))
  }

  async function completeFinalResponse(request: FinalResponseRequest) {
    return completePayload(request, buildFinalResponsePayload(request))
  }

  return {
    completeAction,
    completeFinalResponse,
    repairAction(request) {
      return completeAction({
        ...request,
        task: buildRepairTask(request),
        stream: false,
      })
    },
  }
}

function buildRepairTask(request: RepairActionRequest) {
  return [
    request.task,
    '',
    'The previous model action output was invalid. Repair only the action output for the same screenshot and task.',
    `<invalid_action_output>\n${request.invalidOutput}\n</invalid_action_output>`,
    `<validation_error>\n${request.validationError}\n</validation_error>`,
    'Return only one corrected canonical JSON action object. No markdown, no prose.',
  ].join('\n')
}
