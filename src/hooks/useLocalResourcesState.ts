import { useEffect, useState } from 'react'
import {
  createDefaultAppCards,
  loadAppCards,
  parseAppCardsJson,
  saveAppCards,
  serializeAppCards,
} from '../lib/appCards'
import {
  loadCustomToolDefinitions,
  loadSecretRecordsDecrypted,
  parseCustomToolDefinitionsJson,
  parseSecretRecordsJson,
  saveCustomToolDefinitions,
  saveSecretRecords,
  serializeCustomToolDefinitions,
  serializeSecretRecords,
} from '../lib/agentResources'

export function useLocalResourcesState() {
  const [appCards, setAppCards] = useState(() => loadAppCards())
  const [appCardsJson, setAppCardsJson] = useState(() => serializeAppCards(appCards))
  const [appCardsJsonError, setAppCardsJsonError] = useState<string | null>(null)
  const [secretRecords, setSecretRecords] = useState<
    ReturnType<typeof parseSecretRecordsJson>
  >(() => parseSecretRecordsJson('[]'))
  const [secretRecordsJson, setSecretRecordsJson] = useState(() =>
    serializeSecretRecords(secretRecords),
  )
  const [secretRecordsJsonError, setSecretRecordsJsonError] = useState<string | null>(null)
  const [customTools, setCustomTools] = useState(() => loadCustomToolDefinitions())
  const [customToolsJson, setCustomToolsJson] = useState(() =>
    serializeCustomToolDefinitions(customTools),
  )
  const [customToolsJsonError, setCustomToolsJsonError] = useState<string | null>(null)

  // Decrypt any previously-encrypted secret values on mount, so the rest of the
  // app works with plaintext values in memory while they remain encrypted at rest.
  useEffect(() => {
    let active = true
    void loadSecretRecordsDecrypted().then((decrypted) => {
      if (!active) {
        return
      }
      setSecretRecords(decrypted)
      setSecretRecordsJson(serializeSecretRecords(decrypted))
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => saveAppCards(appCards), [appCards])
  useEffect(() => {
    void saveSecretRecords(secretRecords)
  }, [secretRecords])
  useEffect(() => saveCustomToolDefinitions(customTools), [customTools])

  function updateAppCardsJson(value: string) {
    setAppCardsJson(value)
    try {
      const nextAppCards = parseAppCardsJson(value)
      setAppCards(nextAppCards)
      setAppCardsJsonError(null)
    } catch (caught) {
      setAppCardsJsonError(errorMessage(caught))
    }
  }

  function resetAppCards() {
    const nextAppCards = createDefaultAppCards()
    setAppCards(nextAppCards)
    setAppCardsJson(serializeAppCards(nextAppCards))
    setAppCardsJsonError(null)
  }

  function updateSecretRecordsJson(value: string) {
    setSecretRecordsJson(value)
    try {
      const nextSecrets = parseSecretRecordsJson(value)
      setSecretRecords(nextSecrets)
      setSecretRecordsJsonError(null)
    } catch (caught) {
      setSecretRecordsJsonError(errorMessage(caught))
    }
  }

  function updateCustomToolsJson(value: string) {
    setCustomToolsJson(value)
    try {
      const nextTools = parseCustomToolDefinitionsJson(value)
      setCustomTools(nextTools)
      setCustomToolsJsonError(null)
    } catch (caught) {
      setCustomToolsJsonError(errorMessage(caught))
    }
  }

  return {
    appCards,
    appCardsJson,
    appCardsJsonError,
    customTools,
    customToolsJson,
    customToolsJsonError,
    resetAppCards,
    secretRecords,
    secretRecordsJson,
    secretRecordsJsonError,
    updateAppCardsJson,
    updateCustomToolsJson,
    updateSecretRecordsJson,
  }
}

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught)
}
