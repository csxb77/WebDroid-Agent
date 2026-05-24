import { describe, expect, it } from 'vitest'
import type { DeviceScreenshot } from '../adapters/deviceTypes'
import type { AgentAction } from './actionTypes'
import {
  createAgentThread,
  recordThreadTurnExecution,
  startThreadTurn,
} from './agentThread'
import { buildInteractionStream } from './interactionStream'

const screenshot: DeviceScreenshot = {
  bytes: new Uint8Array([1, 2, 3]),
  dataUrl: 'data:image/png;base64,abc',
  screen: { width: 1080, height: 2400 },
}

describe('interaction stream', () => {
  it('groups agent turns with their execution results instead of duplicated observations', () => {
    const thread = createAgentThread('Open Settings', { id: 'thread-stream', now: 1000 })
    const tapAction: AgentAction = { action: 'tap', x: 100, y: 200, reason: 'open Wi-Fi' }
    const tapTurn = startThreadTurn(thread, {
      id: 'turn-tap',
      index: 1,
      task: 'Open Settings',
      latestUserMessage: 'Open Settings',
      promptContext: 'Task: Open Settings',
      modelOutput: '{"action":"tap","x":100,"y":200}',
      action: tapAction,
      executionAction: tapAction,
      preview: 'tap (100, 200) - open Wi-Fi',
      deviceSnapshot: {
        currentApp: 'Settings',
        deviceState: { app: 'Settings', packageName: 'com.android.settings' },
        screenshot,
      },
      timing: { captureMs: 1, currentAppMs: 2, modelMs: 3, parseMs: 4, totalMs: 10 },
      now: 1100,
    })
    recordThreadTurnExecution(thread, tapTurn.id, {
      executionResult: 'input tap 100 200',
      success: true,
      now: 1200,
    })

    const doneAction: AgentAction = { action: 'done', summary: 'Wi-Fi settings is open.' }
    const doneTurn = startThreadTurn(thread, {
      id: 'turn-done',
      index: 2,
      task: 'Open Settings',
      latestUserMessage: 'Open Settings',
      promptContext: 'Task: Open Settings',
      modelOutput: '{"action":"done","summary":"Wi-Fi settings is open."}',
      action: doneAction,
      executionAction: doneAction,
      preview: 'done - Wi-Fi settings is open.',
      deviceSnapshot: {
        currentApp: 'Settings',
        deviceState: { app: 'Settings', packageName: 'com.android.settings' },
        screenshot,
      },
      timing: { captureMs: 1, currentAppMs: 2, modelMs: 3, parseMs: 4, totalMs: 10 },
      now: 1300,
    })
    recordThreadTurnExecution(thread, doneTurn.id, { now: 1400 })

    const stream = buildInteractionStream(thread)

    expect(stream.map((item) => item.type)).toEqual(['message', 'step', 'step', 'message'])
    expect(stream[1]).toEqual(
      expect.objectContaining({
        type: 'step',
        turn: expect.objectContaining({
          preview: 'tap (100, 200) - open Wi-Fi',
          executionResult: 'input tap 100 200',
        }),
      }),
    )
    expect(stream.some((item) => item.id.includes(thread.messages[1].id))).toBe(false)
    expect(stream.at(-1)).toEqual(
      expect.objectContaining({
        type: 'message',
        message: expect.objectContaining({
          role: 'assistant',
          content: 'Wi-Fi settings is open.',
        }),
      }),
    )
  })
})
