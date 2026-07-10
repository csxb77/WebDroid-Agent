export type ExportEnvelope<Data> = {
  type: string
  version: number
  exportedAt: number
  data: Data
}

export function downloadJsonFile(filename: string, data: unknown): void {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function pickAndReadJsonFile(): Promise<unknown | null> {
  if (typeof document === 'undefined') {
    return Promise.resolve(null)
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.style.display = 'none'
  document.body.append(input)

  return new Promise<unknown | null>((resolve, reject) => {
    input.oncancel = () => {
      resolve(null)
    }

    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          resolve(reader.result == null ? null : JSON.parse(reader.result as string))
        } catch (caught) {
          reject(caught instanceof Error ? caught : new Error(String(caught)))
        }
      }
      reader.onerror = () => {
        reject(reader.error ?? new Error('Failed to read file.'))
      }
      reader.readAsText(file)
    }

    input.click()
  }).finally(() => {
    input.remove()
  })
}
