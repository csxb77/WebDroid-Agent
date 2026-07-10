import { describe, expect, it } from 'vitest'
import {
  buildScreenshotContext,
  chooseGridDivisions,
  fitDimensionsToMaxSide,
  mapActionCoordinates,
  modelScreenshotView,
} from './coordinates'

describe('fitDimensionsToMaxSide', () => {
  it('keeps small screenshots unchanged', () => {
    expect(fitDimensionsToMaxSide({ width: 720, height: 1280 })).toEqual({
      width: 720,
      height: 1280,
    })
  })

  it('scales the longest side down to the model limit', () => {
    expect(fitDimensionsToMaxSide({ width: 1080, height: 2316 })).toEqual({
      width: 716,
      height: 1536,
    })
  })
})

describe('chooseGridDivisions', () => {
  it('adapts grid density to the model screenshot size', () => {
    expect(chooseGridDivisions({ width: 360, height: 720 })).toBe(6)
    expect(chooseGridDivisions({ width: 900, height: 1600 })).toBe(8)
    expect(chooseGridDivisions({ width: 716, height: 1536 })).toBe(8)
  })
})

describe('buildScreenshotContext', () => {
  it('describes the model coordinate space and native device mapping', () => {
    expect(
      buildScreenshotContext({
        modelScreen: { width: 716, height: 1536 },
        deviceScreen: { width: 1080, height: 2316 },
      }),
    ).toEqual({
      model_screen_size: '716x1536',
      device_screen_size: '1080x2316',
      coordinate_mode: 'screenshot_pixels',
      coordinate_origin: 'top_left',
      grid_divisions: 8,
      grid_labels: 'major_lines_only',
      execution_mapping: 'model_coordinates_are_mapped_back_to_device_pixels',
      resized: true,
    })
  })

  it('describes normalized 0-1000 coordinate space when requested', () => {
    expect(
      buildScreenshotContext({
        modelScreen: { width: 500, height: 1000 },
        deviceScreen: { width: 1000, height: 2000 },
        coordinateMode: 'normalized_0_1000',
      }),
    ).toEqual({
      model_screen_size: '500x1000',
      device_screen_size: '1000x2000',
      coordinate_mode: 'normalized_0_1000',
      coordinate_origin: 'top_left',
      coordinate_range: '0..1000',
      grid_divisions: 6,
      grid_labels: '0_1000_major_lines',
      execution_mapping:
        'normalized_coordinates_are_mapped_to_model_screenshot_pixels_then_device_pixels',
      resized: true,
    })
  })
})

describe('mapActionCoordinates', () => {
  const modelScreen = { width: 500, height: 1000 }
  const deviceScreen = { width: 1000, height: 2000 }

  it('maps tap coordinates from model screenshot pixels to device pixels', () => {
    expect(
      mapActionCoordinates(
        { action: 'tap', x: 250, y: 500, reason: 'open', message: 'confirm', risk: 'sensitive' },
        modelScreen,
        deviceScreen,
      ),
    ).toEqual({
      action: 'tap',
      x: 500,
      y: 1000,
      reason: 'open',
      message: 'confirm',
      risk: 'sensitive',
    })
  })

  it('maps all touch points on swipe and press actions', () => {
    expect(
      mapActionCoordinates(
        {
          action: 'swipe',
          fromX: 50,
          fromY: 100,
          toX: 450,
          toY: 900,
          durationMs: 600,
          reason: 'scroll',
        },
        modelScreen,
        deviceScreen,
      ),
    ).toEqual({
      action: 'swipe',
      fromX: 100,
      fromY: 200,
      toX: 899,
      toY: 1799,
      durationMs: 600,
      reason: 'scroll',
    })

    expect(
      mapActionCoordinates(
        { action: 'long_press', x: 125, y: 250, durationMs: 900 },
        modelScreen,
        deviceScreen,
      ),
    ).toEqual({ action: 'long_press', x: 250, y: 500, durationMs: 900 })

    expect(
      mapActionCoordinates({ action: 'double_tap', x: 400, y: 750 }, modelScreen, deviceScreen),
    ).toEqual({ action: 'double_tap', x: 799, y: 1499 })
  })

  it('clamps mapped touch coordinates to the target screen edge', () => {
    expect(
      mapActionCoordinates({ action: 'tap', x: 999, y: 1999 }, deviceScreen, modelScreen),
    ).toEqual({ action: 'tap', x: 499, y: 999 })

    expect(
      mapActionCoordinates(
        { action: 'swipe', fromX: 999, fromY: 1999, toX: 1000, toY: 2000 },
        deviceScreen,
        modelScreen,
      ),
    ).toEqual({
      action: 'swipe',
      fromX: 499,
      fromY: 999,
      toX: 499,
      toY: 999,
    })
  })

  it('leaves non-coordinate actions unchanged', () => {
    expect(
      mapActionCoordinates(
        { action: 'input_text', text: 'hello', clear: true },
        modelScreen,
        deviceScreen,
      ),
    ).toEqual({ action: 'input_text', text: 'hello', clear: true })
  })
})

describe('modelScreenshotView', () => {
  it('prefers preprocessed screenshots when available', () => {
    expect(
      modelScreenshotView({
        bytes: new Uint8Array(),
        dataUrl: 'data:image/png;base64,raw',
        screen: { width: 1000, height: 2000 },
        modelDataUrl: 'data:image/png;base64,model',
        modelScreen: { width: 500, height: 1000 },
      }),
    ).toEqual({
      dataUrl: 'data:image/png;base64,model',
      screen: { width: 500, height: 1000 },
    })
  })
})
