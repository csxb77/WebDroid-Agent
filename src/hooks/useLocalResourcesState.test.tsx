// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUILT_IN_APP_CARDS } from '../lib/appCards'
import { useLocalResourcesState } from './useLocalResourcesState'

describe('useLocalResourcesState', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          values.set(key, value)
        }),
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps editable resource JSON, parsed values, and parse errors together', () => {
    const { result } = renderHook(() => useLocalResourcesState())

    act(() => {
      result.current.updateSecretRecordsJson(
        JSON.stringify([{ id: 'login_password', label: 'Login password', value: 'secret' }]),
      )
    })
    expect(result.current.secretRecords).toEqual([
      { id: 'login_password', label: 'Login password', value: 'secret' },
    ])
    expect(result.current.secretRecordsJsonError).toBeNull()

    act(() => {
      result.current.updateSecretRecordsJson('{')
    })
    expect(result.current.secretRecords).toEqual([
      { id: 'login_password', label: 'Login password', value: 'secret' },
    ])
    expect(result.current.secretRecordsJsonError).toContain('JSON')

    act(() => {
      result.current.resetAppCards()
    })
    expect(result.current.appCards).toEqual(BUILT_IN_APP_CARDS)
    expect(result.current.appCardsJsonError).toBeNull()
  })
})
