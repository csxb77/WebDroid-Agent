export type RetryOptions = {
  retryDelaysMs: readonly number[]
  signal?: AbortSignal
  label?: string
}

export async function fetchWithRetry(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  { retryDelaysMs, signal, label = 'request' }: RetryOptions,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetcher(url, init)
      if (!shouldRetryResponse(response) || attempt >= retryDelaysMs.length) {
        return response
      }
      await discardResponseBody(response)
    } catch (caught) {
      if (isAbortError(caught) || attempt >= retryDelaysMs.length) {
        throw caught
      }
    }

    await waitForRetry(retryDelaysMs[attempt] ?? 0, signal, label)
  }
}

export function shouldRetryResponse(response: Response) {
  return (
    response.status === 408 ||
    response.status === 409 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500
  )
}

export async function discardResponseBody(response: Response) {
  try {
    await response.body?.cancel()
  } catch {
    // Best effort only; the next attempt should not be blocked by cleanup failure.
  }
}

export function waitForRetry(delayMs: number, signal?: AbortSignal, label = 'request') {
  if (signal?.aborted) {
    return Promise.reject(new DOMException(`${label} aborted.`, 'AbortError'))
  }
  if (delayMs <= 0) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false
    const timeoutId = globalThis.setTimeout(() => {
      settled = true
      signal?.removeEventListener('abort', abort)
      resolve()
    }, delayMs)
    function abort() {
      if (settled) {
        return
      }
      settled = true
      globalThis.clearTimeout(timeoutId)
      reject(new DOMException(`${label} aborted.`, 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

export function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export function buildRepairTask(request: {
  task: string
  invalidOutput: string
  validationError: string
}) {
  return [
    request.task,
    '',
    'The previous model action output was invalid. Repair only the action output for the same screenshot and task.',
    `<invalid_action_output>\n${request.invalidOutput}\n</invalid_action_output>`,
    `<validation_error>\n${request.validationError}\n</validation_error>`,
    'Return only one corrected canonical JSON action object. No markdown, no prose.',
  ].join('\n')
}
