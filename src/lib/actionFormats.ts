import { ActionValidationError } from './actionTypes'

export function parseActionCandidate(raw: string): unknown {
  try {
    return JSON.parse(extractJsonObject(raw))
  } catch {
    throw new ActionValidationError('Model response did not contain valid action JSON.')
  }
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const body = fenced?.[1]?.trim() ?? trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new ActionValidationError('Model response did not contain a JSON object.')
  }

  return body.slice(start, end + 1)
}
