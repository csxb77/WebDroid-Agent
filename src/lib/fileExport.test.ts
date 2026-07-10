// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadJsonFile, pickAndReadJsonFile } from './fileExport'

describe('file export helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('downloadJsonFile', () => {
    it('creates an anchor, clicks it, and revokes the object URL', () => {
      const createObjectURL = vi.fn(() => 'blob:mock-url')
      const revokeObjectURL = vi.fn()
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

      const click = vi.fn()
      const anchor = { click, href: '', download: '', rel: '', remove: vi.fn() }
      const append = vi.fn()
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue(
        anchor as unknown as HTMLAnchorElement,
      )
      vi.spyOn(document.body, 'append').mockImplementation(append)
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchor as unknown as ChildNode)

      downloadJsonFile('export.json', { hello: 'world' })

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(anchor.download).toBe('export.json')
      expect(anchor.href).toBe('blob:mock-url')
      expect(click).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      createElement.mockRestore()
    })

    it('no-ops when URL.createObjectURL is unavailable', () => {
      vi.stubGlobal('URL', { createObjectURL: undefined, revokeObjectURL: vi.fn() })
      const createElement = vi.spyOn(document, 'createElement')

      downloadJsonFile('export.json', { hello: 'world' })

      expect(createElement).not.toHaveBeenCalled()
      createElement.mockRestore()
    })
  })

  describe('pickAndReadJsonFile', () => {
    it('resolves with parsed JSON when a file is selected', async () => {
      const file = new File(['{"hello":"world"}'], 'export.json', { type: 'application/json' })
      const input = {
        type: '',
        accept: '',
        style: { display: '' },
        onchange: null as null | ((event: Event) => void),
        oncancel: null as null | (() => void),
        files: { 0: file, length: 1, item: () => file } as unknown as FileList,
        click: vi.fn(),
        remove: vi.fn(),
      }
      vi.spyOn(document, 'createElement').mockReturnValue(input as unknown as HTMLInputElement)
      vi.spyOn(document.body, 'append').mockImplementation(() => {})
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => input as unknown as ChildNode)

      const promise = pickAndReadJsonFile()
      input.onchange?.({ target: input } as unknown as Event)
      await expect(promise).resolves.toEqual({ hello: 'world' })
    })

    it('resolves with null when the user cancels', async () => {
      const input = {
        type: '',
        accept: '',
        style: { display: '' },
        onchange: null as null | ((event: Event) => void),
        oncancel: null as null | (() => void),
        files: {} as unknown as FileList,
        click: vi.fn(),
        remove: vi.fn(),
      }
      vi.spyOn(document, 'createElement').mockReturnValue(input as unknown as HTMLInputElement)
      vi.spyOn(document.body, 'append').mockImplementation(() => {})
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => input as unknown as ChildNode)

      const promise = pickAndReadJsonFile()
      input.oncancel?.()
      await expect(promise).resolves.toBeNull()
    })
  })
})
