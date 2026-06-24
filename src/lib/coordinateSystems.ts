import type { ActionCoordinateMode, ActionProtocol } from './actionProtocol'

export const NORMALIZED_COORDINATE_MAX = 1000

export function coordinateModeForActionProtocol(
  actionProtocol: ActionProtocol,
): ActionCoordinateMode {
  return actionProtocol === 'webdroid_normalized_json'
    ? 'normalized_0_1000'
    : 'screenshot_pixels'
}

export function isNormalizedCoordinateMode(coordinateMode: ActionCoordinateMode) {
  return coordinateMode === 'normalized_0_1000'
}

export const PIXEL_COORDINATE_INSTRUCTION = [
  'Coordinates use pixels in the attached screenshot.',
  'Use numeric x/y labels on major grid lines as anchors; do not answer with grid-cell numbers.',
  'Your screenshot coordinates are mapped back to native device pixels before execution.',
].join(' ')

export const NORMALIZED_COORDINATE_INSTRUCTION = [
  'Coordinates use Vision-Pointer-style 0-1000 normalized coordinates in the attached screenshot.',
  'Origin is top-left; x and y each range from 0 to 1000.',
  'Use numeric x/y labels on major grid lines as anchors; do not answer with grid-cell numbers.',
  'Normalized coordinates are mapped to model screenshot pixels, then native device pixels before execution.',
].join(' ')

export function coordinateInstructionForActionProtocol(
  actionProtocol: ActionProtocol = 'webdroid_json',
) {
  return isNormalizedCoordinateMode(coordinateModeForActionProtocol(actionProtocol))
    ? NORMALIZED_COORDINATE_INSTRUCTION
    : PIXEL_COORDINATE_INSTRUCTION
}

export function protocolCoordinateInstructionForActionProtocol(
  actionProtocol: ActionProtocol,
) {
  if (isNormalizedCoordinateMode(coordinateModeForActionProtocol(actionProtocol))) {
    return [
      'For touch actions, x/y/fromX/fromY/toX/toY fields are',
      'Vision-Pointer-style 0-1000 normalized coordinates from the attached screenshot.',
    ].join(' ')
  }

  return 'For touch actions, x/y/fromX/fromY/toX/toY fields are screenshot pixel coordinates from the attached screenshot.'
}

export function touchCoordinateInstructionForActionProtocol(
  actionProtocol: ActionProtocol,
) {
  if (isNormalizedCoordinateMode(coordinateModeForActionProtocol(actionProtocol))) {
    return [
      'For touch coordinates, use Vision-Pointer-style 0-1000 normalized coordinates from the attached image.',
      'Origin is top-left; x=0 is left, x=1000 is right, y=0 is top, y=1000 is bottom.',
      'Major grid lines may be labeled with x/y normalized values;',
      'use those labels as anchors, not grid-cell numbers.',
    ].join(' ')
  }

  return [
    'For touch coordinates, use screenshot pixel coordinates from the attached image.',
    'Major grid lines may be labeled with x/y pixel values;',
    'use those labels as anchors, not grid-cell numbers.',
  ].join(' ')
}

export function retryCoordinateInstructionForActionProtocol(
  actionProtocol: ActionProtocol = 'webdroid_json',
) {
  if (isNormalizedCoordinateMode(coordinateModeForActionProtocol(actionProtocol))) {
    return 'For the retry, keep using Vision-Pointer-style 0-1000 normalized coordinates.'
  }

  return 'For the retry, keep using screenshot pixel coordinates.'
}
