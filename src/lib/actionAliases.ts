import type { KeyAction } from './actionTypes'

const KEY_ALIASES: Record<string, KeyAction['key']> = {
  APP_SWITCHER: 'APP_SWITCH',
  BACK_BUTTON: 'BACK',
  ENTER_KEY: 'ENTER',
  HOME_BUTTON: 'HOME',
  RECENT: 'APP_SWITCH',
  RECENT_APPS: 'APP_SWITCH',
  RECENTS: 'APP_SWITCH',
  RETURN: 'ENTER',
  VOLDOWN: 'VOLUME_DOWN',
  VOLUP: 'VOLUME_UP',
  VOLUME_DOWN_BUTTON: 'VOLUME_DOWN',
  VOLUME_UP_BUTTON: 'VOLUME_UP',
}

export function canonicalActionName(action: string) {
  return normalizeActionName(action)
}

export function normalizeActionName(action: string) {
  return action.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function normalizeKey(key: string) {
  const normalized = key.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return KEY_ALIASES[normalized] ?? normalized
}

export function isSupportedKey(key: string): key is KeyAction['key'] {
  return [
    'APP_SWITCH',
    'BACK',
    'CAMERA',
    'ENTER',
    'HOME',
    'MENU',
    'POWER',
    'SEARCH',
    'VOLUME_DOWN',
    'VOLUME_UP',
  ].includes(key)
}
