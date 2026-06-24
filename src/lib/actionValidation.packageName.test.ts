import { describe, expect, it } from 'vitest'
import { validateAction } from './actionValidation'

describe('validateAction packageName security', () => {
  it('rejects packageName with shell metacharacters', () => {
    expect(() =>
      validateAction({
        action: 'launch',
        app: 'example',
        packageName: 'x;reboot',
      }),
    ).toThrow('packageName must be a valid Android package name')

    expect(() =>
      validateAction({
        action: 'launch',
        app: 'example',
        packageName: 'a|b',
      }),
    ).toThrow('packageName must be a valid Android package name')

    expect(() =>
      validateAction({
        action: 'launch',
        app: 'example',
        packageName: '$(whoami)',
      }),
    ).toThrow('packageName must be a valid Android package name')
  })

  it('accepts valid package names', () => {
    expect(() =>
      validateAction({
        action: 'launch',
        app: 'example',
        packageName: 'com.example.app',
      }),
    ).not.toThrow()

    expect(() =>
      validateAction({
        action: 'launch',
        app: 'example',
        packageName: 'org.app',
      }),
    ).not.toThrow()
  })

  it('does not treat an app name with a dot as a package unless it matches the format', () => {
    expect(() =>
      validateAction({
        action: 'launch',
        app: '3.14',
      }),
    ).not.toThrow()
    // "3.14" is not a valid package, so it falls back to app-name resolution
    const action = validateAction({ action: 'launch', app: '3.14' }) as {
      packageName?: string
    }
    expect(action.packageName).toBeUndefined()
  })
})
