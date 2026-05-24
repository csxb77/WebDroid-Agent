import {
  AlertTriangle,
  Grid2x2,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  ScanEye,
  Settings as SettingsIcon,
  Settings2,
  SquareTerminal,
  Stethoscope,
  Usb,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ADB_KEYBOARD_APK_URL } from './adapters/deviceCommands'
import type { DeviceInfo, DeviceScreenshot, DeviceState, InstalledApp } from './adapters/deviceTypes'
import { getInstalledAppDisplayName } from './adapters/installedApps'
import { WebAdbDeviceBackend, isWebUsbSupported } from './adapters/webAdbBackend'
import { buildActionPreview } from './lib/actionPreview'
import type { AgentAction } from './lib/actionTypes'
import {
  addUserMessage,
  createAgentRunner,
  createAgentSession,
  queueUserMessage,
  recordAgentStep,
  recordAgentFinalResponse,
  type AgentSession,
  type AgentStep,
} from './lib/agent'
import {
  formatDoctorResults,
  runDeviceDoctor,
  summarizeDoctorResults,
  type DoctorCheckResult,
} from './lib/deviceDoctor'
import { createOpenAiClient } from './lib/openAiClient'
import type { ModelConfig } from './lib/openAiTypes'
import {
  createIndexedDbThreadStore,
  createSettingsSnapshot,
  type AgentThreadSummary,
} from './lib/threadStore'
import { APP_COPY, resolveLocale, type AppCopy } from './lib/appCopy'
import { useBusyTask } from './hooks/useBusyTask'
import { useDeviceBackendPreferences } from './hooks/useDeviceBackendPreferences'
import { useDocumentPreferences } from './hooks/useDocumentPreferences'
import { usePersistedSettings } from './hooks/usePersistedSettings'
import { useRepositoryStats } from './hooks/useRepositoryStats'
import { useRunLog } from './hooks/useRunLog'
import { buildInteractionStream } from './lib/interactionStream'
import { mapActionCoordinates, modelScreenshotView } from './lib/screenshotCoordinates'
import { OPENAI_PROXY_URL } from './lib/openAiRuntimeConfig'
import { loadSettings, type AppSettings } from './lib/settings'
import { createDefaultActionToolRegistry } from './lib/toolRegistry'
import {
  buildAgentStepTimeline,
  formatAgentStepDetail,
  formatScreenCaptureDetail,
  toLogScreenshot,
} from './lib/runLogEntries'
import { DevicePanel } from './components/DevicePanel'
import { ModelPanel } from './components/ModelPanel'
import { PhoneStage } from './components/PhoneStage'
import { RunLog } from './components/RunLog'
import { RunPanel } from './components/RunPanel'
import { SettingsDialog } from './components/SettingsDialog'

type DeviceSnapshotUpdate = {
  currentApp: string
  deviceState: DeviceState
  screenshot: DeviceScreenshot
}

type ConfigTarget = 'model' | 'device' | 'apps' | 'commands' | 'doctor' | 'options'

const CONFIG_TARGET_IDS: Record<ConfigTarget, string> = {
  apps: 'config-installed-apps',
  commands: 'config-direct-commands',
  device: 'config-device',
  doctor: 'config-doctor',
  model: 'config-model',
  options: 'config-device-options',
}

function App() {
  const abortRef = useRef<AbortController | null>(null)
  const settings = useMemo(() => loadSettings(), [])
  const initialSession = useMemo(() => {
    const session = createAgentSession('')
    session.settingsSnapshot = createSettingsSnapshot(settings)
    return session
  }, [settings])
  const sessionRef = useRef<AgentSession>(initialSession)
  const [conversation, setConversation] = useState(() => [...initialSession.messages])
  const [interactionItems, setInteractionItems] = useState(() =>
    buildInteractionStream(initialSession),
  )
  const [backend] = useState(() => new WebAdbDeviceBackend())
  const client = useMemo(
    () => createOpenAiClient(globalThis.fetch, { proxyUrl: OPENAI_PROXY_URL }),
    [],
  )
  const actionToolRegistry = useMemo(() => createDefaultActionToolRegistry(), [])
  const threadStore = useMemo(() => createIndexedDbThreadStore(), [])
  const [threadStoreReady, setThreadStoreReady] = useState(false)
  const [threadSummaries, setThreadSummaries] = useState<AgentThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = useState(initialSession.id)
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false)
  const [modelConfig, setModelConfig] = useState<ModelConfig>(settings.modelConfig)
  const [chatInput, setChatInput] = useState('')
  const [maxSteps, setMaxSteps] = useState(settings.maxSteps)
  const [preferAdbKeyboard, setPreferAdbKeyboard] = useState(settings.preferAdbKeyboard)
  const [confirmSensitiveActions, setConfirmSensitiveActions] = useState(
    settings.confirmSensitiveActions,
  )
  const [streamResponses, setStreamResponses] = useState(settings.streamResponses)
  const [actionSettleMs, setActionSettleMs] = useState(settings.actionSettleMs)
  const [doubleTapIntervalMs, setDoubleTapIntervalMs] = useState(settings.doubleTapIntervalMs)
  const [keyboardStepMs, setKeyboardStepMs] = useState(settings.keyboardStepMs)
  const [themeMode, setThemeMode] = useState(settings.themeMode)
  const [languageMode, setLanguageMode] = useState(settings.languageMode)
  const [configSidebarOpen, setConfigSidebarOpen] = useState(true)
  const [configTarget, setConfigTarget] = useState<ConfigTarget | null>(null)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [currentApp, setCurrentApp] = useState<string>('Unknown')
  const [deviceState, setDeviceState] = useState<DeviceState>({ app: 'Unknown' })
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([])
  const [doctorResults, setDoctorResults] = useState<DoctorCheckResult[]>([])
  const [screenshot, setScreenshot] = useState<DeviceScreenshot | null>(null)
  const [pendingStep, setPendingStep] = useState<AgentStep | null>(null)
  const { logs, addLog, clearLogs } = useRunLog()
  const { busyTask, error, runTask, setError } = useBusyTask(({ label, message }) => {
    addLog({ tone: 'error', title: label, detail: message })
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { repositoryStats, repositoryStatsStatus } = useRepositoryStats(settingsOpen)

  const connected = deviceInfo !== null
  const hasModelConfig = Boolean(modelConfig.baseUrl && modelConfig.apiKey && modelConfig.model)
  const displayedScreenshot = screenshot ? modelScreenshotView(screenshot) : null
  const activeLocale = useMemo(() => resolveLocale(languageMode), [languageMode])
  const copy = APP_COPY[activeLocale]
  const copyRef = useRef(copy)
  const currentSettings = useMemo<AppSettings>(
    () => ({
      modelConfig,
      maxSteps,
      preferAdbKeyboard,
      confirmSensitiveActions,
      streamResponses,
      actionSettleMs,
      doubleTapIntervalMs,
      keyboardStepMs,
      themeMode,
      languageMode,
    }),
    [
      actionSettleMs,
      confirmSensitiveActions,
      doubleTapIntervalMs,
      keyboardStepMs,
      languageMode,
      maxSteps,
      modelConfig,
      preferAdbKeyboard,
      streamResponses,
      themeMode,
    ],
  )
  useDocumentPreferences(themeMode, activeLocale)
  useDeviceBackendPreferences(backend, {
    actionSettleMs,
    doubleTapIntervalMs,
    keyboardStepMs,
    preferAdbKeyboard,
  })
  usePersistedSettings(currentSettings)

  useEffect(() => {
    copyRef.current = copy
  }, [copy])

  useEffect(() => {
    if (!configSidebarOpen || !configTarget) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(CONFIG_TARGET_IDS[configTarget])
      if (element instanceof HTMLDetailsElement) {
        element.open = true
      }
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
      setConfigTarget(null)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [configSidebarOpen, configTarget])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const restoredThread = await threadStore.loadLatest()
        if (!cancelled && restoredThread) {
          sessionRef.current = restoredThread
          applySessionState(restoredThread)
          addLog({
            tone: 'info',
            title: copyRef.current.agentContextRestored,
            detail: restoredThread.title,
            screenshot: toLogScreenshot(
              restoredThread.lastScreenshot ?? restoredThread.deviceSnapshot?.screenshot,
            ),
          })
        }
      } catch (caught) {
        if (cancelled) {
          return
        }
        const message = caught instanceof Error ? caught.message : String(caught)
        addLog({ tone: 'warn', title: copyRef.current.agentContextRestoreSkipped, detail: message })
      }

      try {
        const summaries = await threadStore.list()
        if (!cancelled) {
          applyThreadSummaries(summaries)
        }
      } catch (caught) {
        if (!cancelled) {
          const message = caught instanceof Error ? caught.message : String(caught)
          addLog({ tone: 'warn', title: copyRef.current.agentContextRestoreSkipped, detail: message })
        }
      } finally {
        if (!cancelled) {
          setThreadStoreReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [addLog, threadStore])

  useEffect(() => {
    if (!threadStoreReady) {
      return
    }
    persistSession()
  }, [currentSettings, threadStore, threadStoreReady])

  function updateConfig<Key extends keyof ModelConfig>(key: Key, value: ModelConfig[Key]) {
    setModelConfig((current) => {
      return { ...current, [key]: value }
    })
  }

  function applyDeviceSnapshot({ currentApp, deviceState, screenshot }: DeviceSnapshotUpdate) {
    setScreenshot(screenshot)
    setCurrentApp(currentApp)
    setDeviceState(deviceState)
  }

  async function refreshDisplayedSnapshot() {
    const nextScreenshot = await backend.screenshot()
    const nextDeviceState = await backend.getDeviceState()
    applyDeviceSnapshot({
      screenshot: nextScreenshot,
      currentApp: nextDeviceState.app,
      deviceState: nextDeviceState,
    })
    return { screenshot: nextScreenshot, deviceState: nextDeviceState }
  }

  function logScreenCapture(nextScreenshot: DeviceScreenshot, nextDeviceState: DeviceState) {
    addLog({
      tone: 'ok',
      title: copy.screenCaptured,
      detail: formatScreenCaptureDetail(nextScreenshot, nextDeviceState),
      screenshot: toLogScreenshot(nextScreenshot),
    })
  }

  function ensureSession() {
    return sessionRef.current
  }

  function applyThreadSummaries(summaries: AgentThreadSummary[]) {
    setThreadSummaries(summaries.filter(isVisibleThreadSummary))
  }

  function refreshThreadSummaries() {
    if (!threadStoreReady) {
      return
    }

    void threadStore
      .list()
      .then(applyThreadSummaries)
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : String(caught)
        addLog({ tone: 'warn', title: copyRef.current.agentContextRestoreSkipped, detail: message })
      })
  }

  function applySessionState(session: AgentSession) {
    setActiveThreadId(session.id)
    setConversation([...session.messages])
    setInteractionItems(buildInteractionStream(session))
    setCurrentApp(session.currentApp)
    setDeviceState(session.deviceState)
    setScreenshot(session.lastScreenshot ?? session.deviceSnapshot?.screenshot ?? null)
  }

  function persistSession(session = sessionRef.current) {
    if (!threadStoreReady) {
      return
    }
    if (!sessionHasHistoryContent(session)) {
      refreshThreadSummaries()
      return
    }
    session.settingsSnapshot = createSettingsSnapshot(currentSettings)
    void threadStore
      .save(session)
      .then(() => threadStore.list())
      .then(applyThreadSummaries)
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : String(caught)
        addLog({ tone: 'warn', title: copyRef.current.agentContextRestoreSkipped, detail: message })
      })
  }

  function syncConversation() {
    applySessionState(sessionRef.current)
    persistSession()
  }

  function startNewChat() {
    sessionRef.current = createAgentSession('')
    sessionRef.current.settingsSnapshot = createSettingsSnapshot(currentSettings)
    setChatInput('')
    setPendingStep(null)
    setHistorySidebarOpen(false)
    syncConversation()
    addLog({ tone: 'info', title: copy.newChatStarted })
  }

  async function selectHistoryThread(threadId: string) {
    if (busyTask) {
      return
    }

    try {
      const selectedThread = await threadStore.load(threadId)
      if (!selectedThread) {
        refreshThreadSummaries()
        return
      }

      sessionRef.current = selectedThread
      setChatInput('')
      setPendingStep(null)
      setHistorySidebarOpen(false)
      applySessionState(selectedThread)
      addLog({
        tone: 'info',
        title: copy.agentContextRestored,
        detail: selectedThread.title,
        screenshot: toLogScreenshot(
          selectedThread.lastScreenshot ?? selectedThread.deviceSnapshot?.screenshot,
        ),
      })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      addLog({ tone: 'warn', title: copy.agentContextRestoreSkipped, detail: message })
    }
  }

  async function deleteHistoryThread(threadId: string) {
    if (busyTask) {
      return
    }

    try {
      await threadStore.delete(threadId)
      if (threadId === sessionRef.current.id) {
        sessionRef.current = createAgentSession('')
        sessionRef.current.settingsSnapshot = createSettingsSnapshot(currentSettings)
        setChatInput('')
        setPendingStep(null)
        applySessionState(sessionRef.current)
      }
      const summaries = await threadStore.list()
      applyThreadSummaries(summaries)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      addLog({ tone: 'warn', title: copy.agentContextRestoreSkipped, detail: message })
    }
  }

  function confirmSensitiveAction(message: string) {
    if (!confirmSensitiveActions) {
      return true
    }

    return window.confirm(
      [
        `${copy.sensitiveActionTitle}:`,
        '',
        message,
        '',
        copy.sensitiveActionPrompt,
      ].join('\n'),
    )
  }

  async function connectDevice() {
    await runTask('connect-device', copy.connectDeviceTask, async () => {
      const info = await backend.connect()
      setDeviceInfo(info)
      addLog({ tone: 'ok', title: copy.deviceConnected, detail: `${info.name} (${info.serial})` })
      const { screenshot: nextScreenshot, deviceState: nextDeviceState } =
        await refreshDisplayedSnapshot()
      logScreenCapture(nextScreenshot, nextDeviceState)
      await refreshInstalledApps()
    })
  }

  async function disconnectDevice() {
    await runTask('disconnect-device', copy.disconnectDeviceTask, async () => {
      await backend.disconnect()
      setDeviceInfo(null)
      setCurrentApp('Unknown')
      setDeviceState({ app: 'Unknown' })
      setInstalledApps([])
      setDoctorResults([])
      setScreenshot(null)
      setPendingStep(null)
      addLog({ tone: 'info', title: copy.deviceDisconnected })
    })
  }

  async function captureScreen() {
    await runTask('capture-screen', copy.captureScreenTask, async () => {
      const { screenshot: nextScreenshot, deviceState: nextDeviceState } =
        await refreshDisplayedSnapshot()
      logScreenCapture(nextScreenshot, nextDeviceState)
    })
  }

  async function refreshInstalledApps() {
    if (!backend.getInstalledApps) {
      setInstalledApps([])
      return
    }

    try {
      setInstalledApps(await backend.getInstalledApps())
    } catch {
      setInstalledApps([])
    }
  }

  async function configureAdbKeyboard() {
    await runTask('configure-adb-keyboard', copy.configureTextInput, async () => {
      const inputMethods = await backend.getInputMethods().catch(() => '')
      const adbKeyboardInstalled = /adbkeyboard/i.test(inputMethods)
      const details: string[] = []

      if (!adbKeyboardInstalled) {
        if (typeof fetch !== 'function') {
          throw new Error(copy.noAdbKeyboardDownloadSupport)
        }

        const response = await fetch(ADB_KEYBOARD_APK_URL)
        if (!response.ok) {
          throw new Error(copy.failedToDownloadAdbKeyboard(response.status))
        }

        const apkBytes = new Uint8Array(await response.arrayBuffer())
        details.push(await backend.installAdbKeyboard(apkBytes))
      }

      details.push(await backend.enableAdbKeyboard())
      setPreferAdbKeyboard(true)
      const nextDeviceState = await backend.getDeviceState().catch(() => null)
      if (nextDeviceState) {
        setCurrentApp(nextDeviceState.app)
        setDeviceState(nextDeviceState)
      }
      addLog({
        tone: 'ok',
        title: copy.adbKeyboardConfigured,
        detail: details.filter(Boolean).join('\n'),
      })
    })
  }

  async function runDoctor() {
    await runTask('run-doctor', copy.runDoctor, async () => {
      const results = await runDeviceDoctor({
        connected,
        device: backend,
        deviceInfo,
        fetcher: globalThis.fetch,
        isWebUsbSupported,
        modelConfig,
      })
      setDoctorResults(results)
      addLog({
        tone: results.some((result) => result.status === 'error')
          ? 'error'
          : results.some((result) => result.status === 'warn')
            ? 'warn'
            : 'ok',
        title: copy.doctorSummary,
        detail: [summarizeDoctorResults(results), formatDoctorResults(results)].join('\n\n'),
      })
    })
  }

  async function runDirectAction(action: AgentAction) {
    await runTask('direct-command', copy.directCommand, async () => {
      const result = await backend.execute(action)
      addLog({
        tone: 'ok',
        title: copy.directCommand,
        detail: [buildActionPreview(action), result].filter(Boolean).join('\n'),
      })
      await refreshDisplayedSnapshot()
    })
  }

  function runScreenshotAction(action: AgentAction) {
    const executionAction =
      screenshot && displayedScreenshot
        ? mapActionCoordinates(action, displayedScreenshot.screen, screenshot.screen)
        : action
    void runDirectAction(executionAction)
  }

  function launchInstalledApp(app: InstalledApp) {
    void runDirectAction({
      action: 'launch',
      app: getInstalledAppDisplayName(app),
      packageName: app.packageName,
    })
  }

  function toggleAdbKeyboard(value: boolean) {
    setPreferAdbKeyboard(value)
    backend.setPreferAdbKeyboard(value)
  }

  async function executePendingStep() {
    if (!pendingStep) {
      return
    }

    await runTask('execute-action', copy.executeActionTask, async () => {
      if (pendingStep.action.action === 'done') {
        recordAgentStep(ensureSession(), pendingStep)
        const finalResponse = await recordAgentFinalResponse({
          client,
          modelConfig: { ...modelConfig, stream: streamResponses },
          session: ensureSession(),
          task: ensureSession().task,
        })
        addLog({ tone: 'ok', title: copy.taskComplete, detail: finalResponse })
        setPendingStep(null)
        syncConversation()
        return
      }

      const result = await actionToolRegistry.execute(pendingStep.executionAction, {
        device: backend,
        confirmSensitiveAction,
        safetyContext: {
          task: ensureSession().task,
          currentApp: pendingStep.currentApp,
          deviceState: pendingStep.deviceState,
          modelOutput: pendingStep.modelOutput,
        },
      })
      recordAgentStep(ensureSession(), pendingStep, result.summary, result.success)
      addLog({
        tone: result.success ? 'ok' : 'error',
        title: result.success
          ? copy.executedAction(pendingStep.preview)
          : copy.failedAction(pendingStep.preview),
        detail: result.summary,
        screenshot: toLogScreenshot(pendingStep.screenshot),
        timeline: buildAgentStepTimeline(pendingStep, result.summary),
      })
      if (!result.success) {
        setError(result.summary)
      }
      await refreshDisplayedSnapshot()
      setPendingStep(null)
      syncConversation()
    })
  }

  async function runAutoLoop() {
    const session = ensureSession()
    const abortController = new AbortController()
    abortRef.current = abortController

    await runTask('run-agent', copy.runAgentTask, async () => {
      try {
        const runner = createAgentRunner({ device: backend, client, toolRegistry: actionToolRegistry })
        const result = await runner.run({
          modelConfig: { ...modelConfig, stream: streamResponses },
          task: session.task,
          autoExecute: true,
          maxSteps,
          session,
          signal: abortController.signal,
          confirmSensitiveAction,
          onSnapshot: applyDeviceSnapshot,
          onStep: (step) => {
            applyDeviceSnapshot(step)
            setPendingStep(step.action.action === 'done' ? null : step)
            addLog({
              tone: 'info',
              title: copy.stepPreview(step.index, step.preview),
              detail: formatAgentStepDetail(step),
              screenshot: toLogScreenshot(step.screenshot),
              timeline: buildAgentStepTimeline(step),
            })
            syncConversation()
          },
          onExecuted: async (step, commandResult) => {
            addLog({
              tone: 'ok',
              title: copy.executedAction(step.preview),
              detail: commandResult,
              screenshot: toLogScreenshot(step.screenshot),
              timeline: buildAgentStepTimeline(step, commandResult),
            })
            await refreshDisplayedSnapshot()
            syncConversation()
          },
        })

        if (result.status === 'done') {
          addLog({ tone: 'ok', title: copy.taskComplete, detail: result.finalResponse })
        }
        if (result.status === 'max_steps') {
          addLog({ tone: 'warn', title: copy.maxStepsReached, detail: `${maxSteps} steps` })
        }
        if (result.status === 'stopped') {
          addLog({ tone: 'warn', title: copy.runStopped })
        }
        if (result.status === 'awaiting_takeover') {
          addLog({ tone: 'warn', title: copy.manualTakeoverRequested })
        }
        if (result.status === 'loop_guard') {
          addLog({ tone: 'warn', title: copy.loopGuardStopped, detail: result.reason })
        }
        if (result.status !== 'awaiting_takeover') {
          setPendingStep(null)
        }
        syncConversation()
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null
        }
      }
    })
  }

  function stopCurrentRun() {
    abortRef.current?.abort()
  }

  function openConfigTarget(target: ConfigTarget) {
    setConfigSidebarOpen(true)
    setConfigTarget(target)
  }

  async function submitChatMessage() {
    const message = chatInput.trim()
    if (!message) {
      return
    }

    setChatInput('')
    const session = ensureSession()

    if (busyTask) {
      queueUserMessage(session, message)
      syncConversation()
      addLog({ tone: 'info', title: copy.userMessageQueued, detail: message })
      return
    }

    addUserMessage(session, message)
    syncConversation()
    addLog({ tone: 'info', title: copy.userMessage, detail: message })

    if (!connected || !hasModelConfig) {
      return
    }

    await runAutoLoop()
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <img
            alt="WebDroid Agent logo"
            className="app-logo"
            src="/webdroid-agent-logo.png"
          />
          <h1>WebDroid Agent</h1>
        </div>
        <div className="topbar-actions">
          <div className="status-strip">
            <span className={isWebUsbSupported() ? 'status ok' : 'status warn'}>
              <Usb size={16} />
              WebUSB {isWebUsbSupported() ? copy.webUsbReady : copy.webUsbMissing}
            </span>
            <span className="status">
              <ScanEye size={16} />
              {copy.currentApp}: {currentApp}
            </span>
          </div>
          <button
            type="button"
            className="settings-button"
            aria-label={copy.settings}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon size={16} />
            <span className="settings-button-label">{copy.settings}</span>
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <SettingsDialog
          copy={copy}
          languageMode={languageMode}
          maxSteps={maxSteps}
          onClose={() => setSettingsOpen(false)}
          onLanguageModeChange={setLanguageMode}
          onMaxStepsChange={setMaxSteps}
          onThemeModeChange={setThemeMode}
          repositoryStats={repositoryStats}
          repositoryStatsStatus={repositoryStatsStatus}
          themeMode={themeMode}
        />
      ) : null}

      {error ? (
        <div className="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <section
        className={
          configSidebarOpen ? 'workspace' : 'workspace workspace-config-collapsed'
        }
      >
        <aside
          aria-label={copy.configurationPanel}
          className={
            configSidebarOpen
              ? 'panel config-panel config-panel-expanded'
              : 'panel config-panel config-panel-collapsed'
          }
        >
          <div className="config-sidebar-header">
            {configSidebarOpen ? (
              <span className="config-sidebar-title">{copy.configurationPanel}</span>
            ) : null}
            <button
              type="button"
              className="icon-button config-sidebar-toggle"
              aria-expanded={configSidebarOpen}
              aria-label={
                configSidebarOpen
                  ? copy.collapseConfigurationPanel
                  : copy.expandConfigurationPanel
              }
              title={
                configSidebarOpen
                  ? copy.collapseConfigurationPanel
                  : copy.expandConfigurationPanel
              }
              onClick={() => setConfigSidebarOpen((current) => !current)}
            >
              {configSidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            </button>
          </div>

          {configSidebarOpen ? (
            <div className="config-panel-content">
              <section
                className="config-panel-group"
                id={CONFIG_TARGET_IDS.model}
                aria-label={copy.model}
              >
                <ModelPanel
                  copy={copy}
                  modelConfig={modelConfig}
                  onModelConfigChange={updateConfig}
                  onStreamResponsesChange={setStreamResponses}
                  streamResponses={streamResponses}
                />
              </section>

              <DevicePanel
                actionSettleMs={actionSettleMs}
                busyTask={busyTask}
                connected={connected}
                copy={copy}
                currentApp={currentApp}
                deviceInfo={deviceInfo}
                deviceSectionId={CONFIG_TARGET_IDS.device}
                doctorResults={doctorResults}
                doctorSectionId={CONFIG_TARGET_IDS.doctor}
                deviceState={deviceState}
                deviceOptionsSectionId={CONFIG_TARGET_IDS.options}
                directCommandsSectionId={CONFIG_TARGET_IDS.commands}
                doubleTapIntervalMs={doubleTapIntervalMs}
                installedApps={installedApps}
                installedAppsSectionId={CONFIG_TARGET_IDS.apps}
                keyboardStepMs={keyboardStepMs}
                onActionSettleMsChange={setActionSettleMs}
                onCaptureScreen={captureScreen}
                onConfirmSensitiveActionsChange={setConfirmSensitiveActions}
                onConnectDevice={connectDevice}
                onDisconnectDevice={disconnectDevice}
                onDoubleTapIntervalMsChange={setDoubleTapIntervalMs}
                onConfigureAdbKeyboard={configureAdbKeyboard}
                onKeyboardStepMsChange={setKeyboardStepMs}
                onLaunchInstalledApp={launchInstalledApp}
                onPreferAdbKeyboardChange={toggleAdbKeyboard}
                onRunDirectAction={runDirectAction}
                onRunDoctor={runDoctor}
                preferAdbKeyboard={preferAdbKeyboard}
                confirmSensitiveActions={confirmSensitiveActions}
              />
            </div>
          ) : (
            <ConfigRail
              copy={copy}
              items={[
                { icon: KeyRound, label: copy.model, target: 'model' },
                { icon: Usb, label: copy.device, target: 'device' },
                { icon: Grid2x2, label: copy.installedApps, target: 'apps' },
                { icon: SquareTerminal, label: copy.directCommands, target: 'commands' },
                { icon: Stethoscope, label: copy.runDoctor, target: 'doctor' },
                { icon: Settings2, label: copy.deviceOptions, target: 'options' },
              ]}
              onSelect={openConfigTarget}
            />
          )}
        </aside>

        <PhoneStage
          copy={copy}
          displayedScreenshot={displayedScreenshot}
          onRunInteractiveAction={runScreenshotAction}
          pendingStep={pendingStep}
        />

        <aside className="panel run-panel">
          <RunPanel
            activeThreadId={activeThreadId}
            busyTask={busyTask}
            chatInput={chatInput}
            conversation={conversation}
            interactionItems={interactionItems}
            copy={copy}
            historySidebarOpen={historySidebarOpen}
            onChatInputChange={setChatInput}
            onCloseHistorySidebar={() => setHistorySidebarOpen(false)}
            onDeleteThread={(threadId) => {
              void deleteHistoryThread(threadId)
            }}
            onExecutePendingStep={executePendingStep}
            onSelectThread={(threadId) => {
              void selectHistoryThread(threadId)
            }}
            onStartNewChat={startNewChat}
            onStopRun={stopCurrentRun}
            onSubmitChatMessage={submitChatMessage}
            onToggleHistorySidebar={() => setHistorySidebarOpen((current) => !current)}
            pendingStep={pendingStep}
            threadSummaries={threadSummaries}
          />
        </aside>
      </section>

      <details className="log-drawer compact-section">
        <summary>
          <span>{copy.runLog}</span>
          <small>{logs[0]?.title ?? copy.noEvents}</small>
        </summary>
        <RunLog
          logs={logs}
          onClear={clearLogs}
          labels={{
            clear: copy.clear,
            empty: copy.noEvents,
            title: copy.runLog,
            closeScreenshotPreview: copy.closeScreenshotPreview,
            openScreenshotFor: copy.openScreenshotFor,
            screenshotDialogFor: copy.screenshotDialogFor,
            screenshotFor: (title) => `${copy.androidScreenshot}: ${title}`,
            expandedScreenshotFor: (title) => `${copy.expandedAndroidScreenshot}: ${title}`,
          }}
        />
      </details>
    </main>
  )
}

export default App

type ConfigRailItem = {
  icon: LucideIcon
  label: string
  target: ConfigTarget
}

function ConfigRail({
  copy,
  items,
  onSelect,
}: {
  copy: AppCopy
  items: ConfigRailItem[]
  onSelect: (target: ConfigTarget) => void
}) {
  return (
    <nav className="config-rail" aria-label={copy.configurationPanel}>
      {items.map(({ icon: Icon, label, target }) => (
        <button
          type="button"
          className="config-rail-button"
          key={target}
          aria-label={copy.openConfigurationSection(label)}
          title={label}
          onClick={() => onSelect(target)}
        >
          <Icon size={18} />
        </button>
      ))}
    </nav>
  )
}

function sessionHasHistoryContent(session: AgentSession) {
  return (
    session.task.trim().length > 0 ||
    session.messages.length > 0 ||
    session.turns.length > 0 ||
    session.history.length > 0
  )
}

function isVisibleThreadSummary(summary: AgentThreadSummary) {
  return (
    summary.task.trim().length > 0 ||
    summary.status !== 'idle' ||
    summary.createdAt !== summary.updatedAt
  )
}
