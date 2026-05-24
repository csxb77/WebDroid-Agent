import { describe, expect, it, vi } from 'vitest'
import type { DeviceBackend } from '../adapters/deviceTypes'
import { createDefaultActionToolRegistry } from './toolRegistry'

function fakeDevice(): DeviceBackend & { executed: string[] } {
  const executed: string[] = []
  return {
    executed,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getCurrentApp: vi.fn(async () => 'Chrome'),
    getDeviceState: vi.fn(async () => ({ app: 'Chrome' })),
    screenshot: vi.fn(async () => ({
      bytes: new Uint8Array(),
      dataUrl: 'data:image/png;base64,abc',
      screen: { width: 1080, height: 2400 },
    })),
    execute: vi.fn(async (action) => {
      executed.push(action.action)
      return `${action.action} executed`
    }),
  }
}

describe('ActionToolRegistry', () => {
  it('exposes action signatures from one registry', () => {
    const registry = createDefaultActionToolRegistry()
    const signatures = registry.getSignatures()

    expect(signatures.tap.description).toContain('Tap')
    expect(signatures.tap.parameters.x).toEqual(
      expect.objectContaining({ required: true, type: 'number' }),
    )
    expect(signatures.input_text.parameters.text).toEqual(
      expect.objectContaining({ required: true, type: 'string' }),
    )
    expect(signatures.input_text.parameters.clear).toEqual(
      expect.objectContaining({ required: false, type: 'boolean', default: false }),
    )
    expect(signatures).not.toHaveProperty('interact')
    expect(signatures).not.toHaveProperty('call_api')
  })

  it('executes device actions through one normalized result shape', async () => {
    const device = fakeDevice()
    const registry = createDefaultActionToolRegistry()

    const result = await registry.execute(
      { action: 'tap', x: 100, y: 200 },
      { device },
    )

    expect(result).toEqual({
      success: true,
      summary: 'tap executed',
      toolName: 'tap',
    })
    expect(device.executed).toEqual(['tap'])
  })

  it('normalizes disabled tools without touching the device', async () => {
    const device = fakeDevice()
    const registry = createDefaultActionToolRegistry(['tap'])

    const result = await registry.execute(
      { action: 'tap', x: 100, y: 200 },
      { device },
    )

    expect(result.success).toBe(false)
    expect(result.summary).toContain('disabled')
    expect(device.executed).toEqual([])
  })

  it('applies local safety policy before executing device actions', async () => {
    const device = fakeDevice()
    const registry = createDefaultActionToolRegistry()

    const result = await registry.execute(
      { action: 'tap', x: 100, y: 200 },
      { device, safetyContext: { task: 'Pay now and place order' } },
    )

    expect(result).toEqual({
      success: false,
      summary: 'Safety policy blocked a payment, checkout, order, or money-transfer action.',
      toolName: 'tap',
      safetyDecision: 'block',
    })
    expect(device.executed).toEqual([])
  })

  it('asks for local safety confirmation without relying on model risk metadata', async () => {
    const device = fakeDevice()
    const registry = createDefaultActionToolRegistry()
    const confirmSensitiveAction = vi.fn(async () => true)

    const result = await registry.execute(
      { action: 'tap', x: 100, y: 200 },
      {
        device,
        confirmSensitiveAction,
        safetyContext: { task: 'Allow Contacts permission' },
      },
    )

    expect(result).toEqual({
      success: true,
      summary: 'tap executed',
      toolName: 'tap',
    })
    expect(confirmSensitiveAction).toHaveBeenCalledWith(
      'Safety policy requires confirmation before authorization, permission, or account-setting changes.',
      { action: 'tap', x: 100, y: 200 },
    )
    expect(device.executed).toEqual(['tap'])
  })

  it('turns legacy fake actions into takeover results without touching the device', async () => {
    const device = fakeDevice()
    const registry = createDefaultActionToolRegistry()

    await expect(
      registry.execute({ action: 'interact', message: 'choose an account' }, { device }),
    ).resolves.toEqual({
      success: false,
      summary: 'choose an account',
      toolName: 'interact',
      safetyDecision: 'take_over',
    })
    await expect(
      registry.execute({ action: 'call_api', instruction: 'summarize notes' }, { device }),
    ).resolves.toEqual({
      success: false,
      summary: 'Unsupported call_api action: summarize notes',
      toolName: 'call_api',
      safetyDecision: 'take_over',
    })
    expect(device.executed).toEqual([])
  })
})
