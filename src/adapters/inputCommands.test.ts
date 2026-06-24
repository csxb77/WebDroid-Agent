import { describe, expect, it } from 'vitest'
import { buildInputCommandSequence } from './inputCommands'
import { escapeInputText } from './adbKeyboard'

describe('buildInputCommandSequence security', () => {
  it('escapes shell metacharacters in open_url', () => {
    const sequence = buildInputCommandSequence({
      action: 'open_url',
      url: 'http://x;input keyevent 26',
    })
    const command = sequence[0] as string[]
    expect(command.join(' ')).toContain(`'http://x;input keyevent 26'`)
  })

  it('escapes pipe and command substitution in url', () => {
    const sequence = buildInputCommandSequence({
      action: 'open_url',
      url: 'a|b$(reboot)',
    })
    const command = sequence[0] as string[]
    expect(command.join(' ')).toContain(`'a|b$(reboot)'`)
  })
})

describe('escapeInputText security', () => {
  it('escapes whitespace as %s', () => {
    expect(escapeInputText('hello world')).toBe('hello%sworld')
  })

  it('escapes backslash to prevent shell escaping', () => {
    expect(escapeInputText('path\\to\\file')).toBe('path\\\\to\\\\file')
  })

  it('escapes both whitespace and backslash', () => {
    expect(escapeInputText('a\\b c')).toBe('a\\\\b%sc')
  })
})
