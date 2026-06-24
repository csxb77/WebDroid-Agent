import { parseActionCandidate } from './actionFormats'
import type { ActionProtocol } from './actionProtocol'
import { coordinateModeForActionProtocol } from './coordinateSystems'
import { validateAction } from './actionValidation'
import type { AgentAction, ScreenSize } from './actionTypes'

export function parseModelAction(
  raw: string,
  screen?: ScreenSize,
  actionProtocol: ActionProtocol = 'webdroid_json',
): AgentAction {
  return validateAction(parseActionCandidate(raw), screen, {
    coordinateMode: coordinateModeForActionProtocol(actionProtocol),
  })
}

export { validateAction }
