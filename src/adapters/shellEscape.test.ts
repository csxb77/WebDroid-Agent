import { describe, expect, it } from 'vitest'
import { escapeShellArg } from './shellEscape'

describe('escapeShellArg', () => {
  it('wraps simple strings in single quotes', () => {
    expect(escapeShellArg('hello')).toBe(`'hello'`)
  })

  it('escapes single quotes inside the value', () => {
    expect(escapeShellArg(`it's`)).toBe(`'it'\\''s'`)
  })

  it('keeps shell metacharacters literal when quoted', () => {
    expect(escapeShellArg('http://x;rm -rf /')).toBe(`'http://x;rm -rf /'`)
    expect(escapeShellArg('a|b')).toBe(`'a|b'`)
    expect(escapeShellArg('backtickwhoamibacktick')).toBe(`'backtickwhoamibacktick'`)
    expect(escapeShellArg('$(reboot)')).toBe(`'$(reboot)'`)
    expect(escapeShellArg('line1\nline2')).toBe(`'line1\nline2'`)
  })

  it('handles empty strings', () => {
    expect(escapeShellArg('')).toBe(`''`)
  })
})
