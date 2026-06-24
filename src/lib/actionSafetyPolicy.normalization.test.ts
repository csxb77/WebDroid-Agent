import { describe, expect, it } from 'vitest'
import { evaluateActionSafety } from './actionSafetyPolicy'

describe('evaluateActionSafety NFKC normalization', () => {
  it('normalizes full-width characters before pattern matching', () => {
    expect(
      evaluateActionSafety(
        { action: 'tap', x: 100, y: 200 },
        { task: '全額付款' },
      ),
    ).toEqual(
      expect.objectContaining({
        decision: 'block',
        category: 'payment',
      }),
    )
  })

  it('normalizes math letter variants before pattern matching', () => {
    expect(
      evaluateActionSafety(
        { action: 'tap', x: 100, y: 200 },
        { task: '𝐩𝐚𝐲 𝐧𝐨𝐰' },
      ),
    ).toEqual(
      expect.objectContaining({
        decision: 'block',
        category: 'payment',
      }),
    )
  })

  it('checks type_secret for safety based on context', () => {
    expect(
      evaluateActionSafety(
        { action: 'type_secret', secretId: 'password' },
        { task: 'Enter the password' },
      ),
    ).toEqual(
      expect.objectContaining({
        decision: 'take_over',
      }),
    )
  })
})
