import { useId, useState } from 'react'
import { Bot, Eye, EyeOff } from 'lucide-react'
import type { AppCopy } from '../lib/appCopy'
import { isActionProtocol, type ActionProtocol } from '../lib/actionProtocol'
import {
  DEFAULT_QWEN_THINKING_BUDGET,
  MAX_QWEN_THINKING_BUDGET,
  MIN_QWEN_THINKING_BUDGET,
  MODEL_PROVIDER_PRESETS,
  inferProviderPreset,
  isModelProviderPreset,
  type ModelProviderPreset,
} from '../lib/modelProviders'
import type { ModelConfig } from '../lib/openAiTypes'

type RequiredModelFieldKey = 'apiKey' | 'baseUrl' | 'model'

export type ModelPanelProps = {
  actionProtocol: ActionProtocol
  copy: AppCopy
  modelConfig: ModelConfig
  onActionProtocolChange: (value: ActionProtocol) => void
  onModelConfigChange: <Key extends keyof ModelConfig>(key: Key, value: ModelConfig[Key]) => void
  onStreamResponsesChange: (value: boolean) => void
  streamResponses: boolean
}

export function ModelPanel({
  actionProtocol,
  copy,
  modelConfig,
  onActionProtocolChange,
  onModelConfigChange,
  onStreamResponsesChange,
  streamResponses,
}: ModelPanelProps) {
  const apiKeyInputId = useId()
  const baseUrlInputId = useId()
  const modelInputId = useId()
  const providerInputId = useId()
  const reasoningEffortInputId = useId()
  const qwenThinkingEnabledInputId = useId()
  const qwenThinkingBudgetInputId = useId()
  const actionProtocolInputId = useId()
  const streamResponsesInputId = useId()
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const providerValue = providerValueFor(modelConfig)
  const isQwenPreset = providerValue === 'qwen'
  const qwenThinkingEnabled = modelConfig.qwenThinkingEnabled ?? true
  const qwenThinkingBudget = modelConfig.qwenThinkingBudget ?? DEFAULT_QWEN_THINKING_BUDGET
  const apiKeyVisibilityLabel = apiKeyVisible ? copy.hideApiKey : copy.showApiKey
  const actionProtocolLabel =
    actionProtocol === 'webdroid_normalized_json'
      ? copy.actionProtocolWebDroidNormalizedJson
      : copy.actionProtocolWebDroidJson
  const requiredModelFields: Array<{
    key: RequiredModelFieldKey
    label: string
    value: string
  }> = [
    { key: 'baseUrl', label: copy.baseUrl, value: modelConfig.baseUrl },
    { key: 'apiKey', label: copy.apiKey, value: modelConfig.apiKey },
    { key: 'model', label: copy.model, value: modelConfig.model },
  ]
  const missingModelFields = requiredModelFields.filter(({ value }) => value.trim().length === 0)
  const missingModelFieldKeys = new Set(missingModelFields.map(({ key }) => key))
  const modelConfigurationReady = missingModelFields.length === 0
  const modelHeadingStatusLabel = modelConfigurationReady
    ? copy.modelConfigurationReadyShort
    : copy.modelConfigurationRequiredNextShort
  const modelHeadingStatusTone = modelConfigurationReady ? 'ready' : 'warning'
  const modelFieldClassName = (key: RequiredModelFieldKey) =>
    missingModelFieldKeys.has(key) ? 'model-settings-field missing' : 'model-settings-field'
  const handleActionProtocolChange = (value: string) => {
    if (isActionProtocol(value)) {
      onActionProtocolChange(value)
    }
  }
  const handleProviderChange = (value: string) => {
    if (!isModelProviderPreset(value)) {
      return
    }
    const preset = MODEL_PROVIDER_PRESETS[value]
    if (!preset) {
      onModelConfigChange('provider', value)
      return
    }

    onModelConfigChange('baseUrl', preset.baseUrl)
    onModelConfigChange('model', preset.model)
    onModelConfigChange('provider', value)
    onModelConfigChange('reasoningEffort', undefined)
    if (value === 'qwen') {
      onModelConfigChange('qwenThinkingEnabled', true)
      onModelConfigChange('qwenThinkingBudget', DEFAULT_QWEN_THINKING_BUDGET)
    } else {
      onModelConfigChange('qwenThinkingEnabled', undefined)
      onModelConfigChange('qwenThinkingBudget', undefined)
    }
  }

  return (
    <>
      <div className="config-section-heading">
        <div className="panel-title">
          <Bot size={18} />
          <h2>{copy.model}</h2>
        </div>
        <span className={`config-section-badge ${modelHeadingStatusTone}`}>
          {modelHeadingStatusLabel}
        </span>
      </div>
      <div className="model-box">
        <div
          className={`model-config-status ${
            modelConfigurationReady ? 'ready' : 'needs-config'
          }`}
          role="status"
          aria-label={copy.modelConfigurationStatus}
        >
          <div className="model-config-status-header">
            <span className="model-config-status-kicker">
              {modelConfigurationReady
                ? copy.modelConfigurationReady
                : copy.modelConfigurationRequiredNext}
            </span>
          </div>
          <div className="model-config-status-main">
            <strong>{modelConfig.model.trim() || copy.noModel}</strong>
            {modelConfigurationReady ? (
              <div className="model-config-chip-row">
                <span className="model-config-chip">{actionProtocolLabel}</span>
              </div>
            ) : (
              <>
                <div className="model-config-chip-row">
                  {missingModelFields.map((field) => (
                    <span className="model-config-chip" key={field.key}>
                      {copy.modelConfigurationNeedsField(field.label)}
                    </span>
                  ))}
                </div>
                {missingModelFields.map((field) => (
                  <p className="model-config-status-help" key={field.key}>
                    {copy.modelConfigurationFieldRequired(field.label)}
                  </p>
                ))}
              </>
            )}
          </div>
        </div>
        <details className="model-details">
          <summary>{copy.modelSettings}</summary>
          <form className="model-settings-form" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor={providerInputId}>
              {copy.provider}
              <select
                id={providerInputId}
                name="provider"
                value={providerValue}
                onChange={(event) => handleProviderChange(event.target.value)}
              >
               <option value="custom">{copy.providerCustom}</option>
               <option value="qwen">{copy.providerQwen}</option>
               <option value="gemini">{copy.providerGemini}</option>
              </select>
            </label>
            <label className={modelFieldClassName('baseUrl')} htmlFor={baseUrlInputId}>
              {copy.baseUrl}
              <input
                id={baseUrlInputId}
                aria-invalid={missingModelFieldKeys.has('baseUrl') || undefined}
                autoComplete="url"
                name="baseUrl"
                value={modelConfig.baseUrl}
                onChange={(event) => onModelConfigChange('baseUrl', event.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </label>
            <div
              className={
                missingModelFieldKeys.has('apiKey')
                  ? 'api-key-setting missing'
                  : 'api-key-setting'
              }
            >
              <label htmlFor={apiKeyInputId}>{copy.apiKey}</label>
              <div className="api-key-field">
                <input
                  id={apiKeyInputId}
                  aria-invalid={missingModelFieldKeys.has('apiKey') || undefined}
                  autoComplete="off"
                  name="apiKey"
                  value={modelConfig.apiKey}
                  onChange={(event) => onModelConfigChange('apiKey', event.target.value)}
                  placeholder="sk-..."
                  type={apiKeyVisible ? 'text' : 'password'}
                />
                <button
                  type="button"
                  className="api-key-visibility-button"
                  aria-label={apiKeyVisibilityLabel}
                  title={apiKeyVisibilityLabel}
                  onClick={() => setApiKeyVisible((current) => !current)}
                >
                  {apiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <label className={modelFieldClassName('model')} htmlFor={modelInputId}>
              {copy.model}
              <input
                id={modelInputId}
                aria-invalid={missingModelFieldKeys.has('model') || undefined}
                autoComplete="off"
                name="model"
                value={modelConfig.model}
                onChange={(event) => onModelConfigChange('model', event.target.value)}
                placeholder="vision-model"
              />
            </label>
            {isQwenPreset ? (
              <>
                <label className="toggle" htmlFor={qwenThinkingEnabledInputId}>
                  <input
                    id={qwenThinkingEnabledInputId}
                    name="qwenThinkingEnabled"
                    type="checkbox"
                    checked={qwenThinkingEnabled}
                    onChange={(event) =>
                      onModelConfigChange('qwenThinkingEnabled', event.target.checked)
                    }
                  />
                  <span>{copy.qwenThinkingMode}</span>
                </label>
                {qwenThinkingEnabled ? (
                  <label htmlFor={qwenThinkingBudgetInputId}>
                    {copy.qwenThinkingBudget}
                    <input
                      id={qwenThinkingBudgetInputId}
                      min={MIN_QWEN_THINKING_BUDGET}
                      max={MAX_QWEN_THINKING_BUDGET}
                      name="qwenThinkingBudget"
                      type="number"
                      value={qwenThinkingBudget}
                      onChange={(event) =>
                        onModelConfigChange(
                          'qwenThinkingBudget',
                          clampQwenThinkingBudget(event.target.valueAsNumber),
                        )
                      }
                    />
                  </label>
                ) : null}
              </>
            ) : (
              <label htmlFor={reasoningEffortInputId}>
                {copy.reasoningEffort}
                <select
                  id={reasoningEffortInputId}
                  name="reasoningEffort"
                  value={modelConfig.reasoningEffort ?? ''}
                  onChange={(event) =>
                    onModelConfigChange(
                      'reasoningEffort',
                      event.target.value
                        ? (event.target.value as ModelConfig['reasoningEffort'])
                        : undefined,
                    )
                  }
                >
                  <option value="">{copy.reasoningEffortDefault}</option>
                  <option value="none">{copy.reasoningEffortNone}</option>
                  <option value="minimal">{copy.reasoningEffortMinimal}</option>
                  <option value="low">{copy.reasoningEffortLow}</option>
                  <option value="medium">{copy.reasoningEffortMedium}</option>
                  <option value="high">{copy.reasoningEffortHigh}</option>
                  <option value="xhigh">{copy.reasoningEffortXHigh}</option>
                </select>
              </label>
            )}
            <label htmlFor={actionProtocolInputId}>
              {copy.actionProtocol}
              <select
                id={actionProtocolInputId}
                name="actionProtocol"
                value={actionProtocol}
                onChange={(event) => handleActionProtocolChange(event.target.value)}
              >
                <option value="webdroid_json">{copy.actionProtocolWebDroidJson}</option>
                <option value="webdroid_normalized_json">
                  {copy.actionProtocolWebDroidNormalizedJson}
                </option>
              </select>
            </label>
            <label className="toggle" htmlFor={streamResponsesInputId}>
              <input
                id={streamResponsesInputId}
                name="streamResponses"
                type="checkbox"
                checked={streamResponses}
                onChange={(event) => onStreamResponsesChange(event.target.checked)}
              />
              <span>{copy.streamModelResponses}</span>
            </label>
          </form>
        </details>
      </div>
    </>
  )
}

function providerValueFor(modelConfig: ModelConfig): ModelProviderPreset {
  return modelConfig.provider ?? inferProviderPreset(modelConfig.baseUrl, modelConfig.model)
}

function clampQwenThinkingBudget(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_QWEN_THINKING_BUDGET
  }

  return Math.min(Math.max(Math.round(value), MIN_QWEN_THINKING_BUDGET), MAX_QWEN_THINKING_BUDGET)
}
