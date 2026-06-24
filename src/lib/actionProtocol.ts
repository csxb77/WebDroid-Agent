export const ACTION_PROTOCOLS = [
  'webdroid_json',
  'webdroid_normalized_json',
] as const

export type ActionProtocol = (typeof ACTION_PROTOCOLS)[number]

export const DEFAULT_ACTION_PROTOCOL: ActionProtocol = 'webdroid_json'

export type ActionCoordinateMode = 'screenshot_pixels' | 'normalized_0_1000'

export function isActionProtocol(value: unknown): value is ActionProtocol {
  return typeof value === 'string' && ACTION_PROTOCOLS.includes(value as ActionProtocol)
}
