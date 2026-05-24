import { describe, expect, it } from 'vitest'
import { evaluateActionSafety } from './actionSafetyPolicy'

describe('evaluateActionSafety', () => {
  it('requires takeover for login, password, captcha, and verification-code steps', () => {
    expect(
      evaluateActionSafety(
        { action: 'input_text', text: '123456' },
        { task: 'Enter the SMS verification code' },
      ),
    ).toEqual({
      decision: 'take_over',
      category: 'secret_or_login',
      message:
        'Safety policy requires manual takeover for login, password, captcha, or verification-code steps.',
    })
  })

  it('blocks payment and irreversible destructive actions before execution', () => {
    expect(
      evaluateActionSafety(
        { action: 'tap', x: 100, y: 200 },
        { task: 'Pay now and place order' },
      ),
    ).toEqual(
      expect.objectContaining({
        decision: 'block',
        category: 'payment',
      }),
    )

    expect(
      evaluateActionSafety(
        { action: 'tap', x: 100, y: 200 },
        { task: 'Delete account permanently' },
      ),
    ).toEqual(
      expect.objectContaining({
        decision: 'block',
        category: 'critical_destructive',
      }),
    )
  })

  it('requires confirmation for authorization and payment-context actions without model risk metadata', () => {
    expect(
      evaluateActionSafety(
        { action: 'tap', x: 100, y: 200 },
        { task: 'Allow Contacts permission' },
      ),
    ).toEqual(
      expect.objectContaining({
        decision: 'confirm',
        category: 'authorization',
      }),
    )

    expect(
      evaluateActionSafety(
        { action: 'tap', x: 100, y: 200 },
        { deviceState: { app: 'Alipay', packageName: 'com.eg.android.AlipayGphone' } },
      ),
    ).toEqual(
      expect.objectContaining({
        decision: 'confirm',
        category: 'payment_context',
      }),
    )
  })

  it('allows non-mutating actions even in sensitive contexts', () => {
    expect(
      evaluateActionSafety(
        { action: 'wait', ms: 1000 },
        { task: 'Wait on payment page' },
      ),
    ).toEqual({ decision: 'allow' })
  })
})
