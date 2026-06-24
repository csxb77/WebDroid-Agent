import { describe, expect, it } from 'vitest'
import { validateAction } from './actionValidation'

describe('validateAction security', () => {
  it('rejects dangerous URI schemes in open_url', () => {
    expect(() =>
      validateAction({
        action: 'open_url',
        url: 'javascript:alert(1)',
      }),
    ).toThrow('open_url scheme must be one of: http, https, mailto, tel, market.')

    expect(() =>
      validateAction({
        action: 'open_url',
        url: 'file:///data/data',
      }),
    ).toThrow('open_url scheme must be one of: http, https, mailto, tel, market.')

    expect(() =>
      validateAction({
        action: 'open_url',
        url: 'intent://example',
      }),
    ).toThrow('open_url scheme must be one of: http, https, mailto, tel, market.')
  })

  it('accepts allowed URI schemes in open_url', () => {
    expect(() =>
      validateAction({
        action: 'open_url',
        url: 'https://example.com',
      }),
    ).not.toThrow()

    expect(() =>
      validateAction({
        action: 'open_url',
        url: 'mailto:test@example.com',
      }),
    ).not.toThrow()

    expect(() =>
      validateAction({
        action: 'open_url',
        url: 'tel:+1234567890',
      }),
    ).not.toThrow()
  })

  it('rejects control characters in set_clipboard', () => {
    expect(() =>
      validateAction({
        action: 'set_clipboard',
        text: 'hello\x00world',
      }),
    ).toThrow('set_clipboard cannot contain control characters.')

    expect(() =>
      validateAction({
        action: 'set_clipboard',
        text: 'line1\nline2',
      }),
    ).toThrow('set_clipboard cannot contain control characters.')
  })
})
