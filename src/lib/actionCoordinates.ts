import type { ActionCoordinateMode } from './actionProtocol'
import { ActionValidationError } from './actionTypes'
import type { ScreenSize } from './actionTypes'
import { NORMALIZED_COORDINATE_MAX } from './coordinateSystems'

export type ActionCoordinateReader = (
  record: Record<string, unknown>,
  key: string,
) => number

export function readPointCoordinates(
  record: Record<string, unknown>,
  screen: ScreenSize | undefined,
  coordinateMode: ActionCoordinateMode,
  readCoordinate: ActionCoordinateReader,
): { x: number; y: number } {
  if ('x' in record && 'y' in record) {
    return resolvePointCoordinates(
      readCoordinateValue(record, 'x', coordinateMode, readCoordinate),
      readCoordinateValue(record, 'y', coordinateMode, readCoordinate),
      screen,
      coordinateMode,
    )
  }

  throw new ActionValidationError('Action must include x/y coordinates.')
}

export function readSwipeCoordinates(
  record: Record<string, unknown>,
  screen: ScreenSize | undefined,
  coordinateMode: ActionCoordinateMode,
  readCoordinate: ActionCoordinateReader,
): { fromX: number; fromY: number; toX: number; toY: number } {
  if ('fromX' in record && 'fromY' in record && 'toX' in record && 'toY' in record) {
    const from = resolvePointCoordinates(
      readCoordinateValue(record, 'fromX', coordinateMode, readCoordinate),
      readCoordinateValue(record, 'fromY', coordinateMode, readCoordinate),
      screen,
      coordinateMode,
    )
    const to = resolvePointCoordinates(
      readCoordinateValue(record, 'toX', coordinateMode, readCoordinate),
      readCoordinateValue(record, 'toY', coordinateMode, readCoordinate),
      screen,
      coordinateMode,
    )
    return {
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
    }
  }

  throw new ActionValidationError('Swipe must include fromX/fromY/toX/toY coordinates.')
}

function readCoordinateValue(
  record: Record<string, unknown>,
  key: string,
  coordinateMode: ActionCoordinateMode,
  readCoordinate: ActionCoordinateReader,
) {
  const value = readCoordinate(record, key)
  if (coordinateMode === 'screenshot_pixels') {
    return value
  }

  if (value < 0 || value > NORMALIZED_COORDINATE_MAX) {
    throw new ActionValidationError(
      `${key} must be a number in the normalized 0-1000 coordinate range.`,
    )
  }
  return value
}

function resolvePointCoordinates(
  x: number,
  y: number,
  screen: ScreenSize | undefined,
  coordinateMode: ActionCoordinateMode,
) {
  if (coordinateMode === 'screenshot_pixels') {
    return { x, y }
  }

  if (!screen) {
    throw new ActionValidationError('Screen size is required for normalized coordinates.')
  }

  return {
    x: normalizedCoordinateToPixel(x, screen.width),
    y: normalizedCoordinateToPixel(y, screen.height),
  }
}

function normalizedCoordinateToPixel(value: number, axisSize: number) {
  if (axisSize <= 0) {
    throw new ActionValidationError('Screen size must be positive for normalized coordinates.')
  }

  return Math.round((value / NORMALIZED_COORDINATE_MAX) * (axisSize - 1))
}
