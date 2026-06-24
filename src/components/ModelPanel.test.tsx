// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_COPY } from '../lib/appCopy'
import { ModelPanel } from './ModelPanel'

type ModelPanelProps = Parameters<typeof ModelPanel>[0]

function createModelPanelProps(overrides: Partial<ModelPanelProps> = {}): ModelPanelProps {
  const props: ModelPanelProps = {
    actionProtocol: 'webdroid_json',
    copy: APP_COPY['en-US'],
    modelConfig: {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'agent-model',
    },
    onActionProtocolChange: vi.fn(),
    onModelConfigChange: vi.fn(),
    onStreamResponsesChange: vi.fn(),
    streamResponses: false,
  }

  return { ...props, ...overrides }
}

describe('ModelPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('offers both WebDroid JSON coordinate protocols', () => {
    render(<ModelPanel {...createModelPanelProps()} />)

    fireEvent.click(screen.getByText('Model settings'))
    const protocolSelect = screen.getByLabelText(/action protocol/i)

    expect(within(protocolSelect).getByRole('option', { name: 'WebDroid JSON' })).toBeTruthy()
    expect(
      within(protocolSelect).getByRole('option', {
        name: 'WebDroid Normalized JSON (0-1000)',
      }),
    ).toBeTruthy()
  })

  it('surfaces missing required model fields before the settings form', () => {
    render(
      <ModelPanel
        {...createModelPanelProps({
          modelConfig: {
            baseUrl: 'https://api.example.com/v1',
            apiKey: '',
            model: 'agent-model',
          },
        })}
      />,
    )

    const status = screen.getByRole('status', { name: 'Model configuration status' })

    expect(status.className).toContain('needs-config')
    expect(within(status).getByText('Needs API Key')).toBeTruthy()
    expect(within(status).getByText('Required next')).toBeTruthy()
    expect(screen.getByText('API Key is required before the agent can run.')).toBeTruthy()
    expect(screen.getByLabelText(/^api key$/i).closest('label, .api-key-setting')?.className).toContain(
      'missing',
    )
  })

  it('shows a clear ready state when model configuration is complete', () => {
    render(<ModelPanel {...createModelPanelProps()} />)

    const status = screen.getByRole('status', { name: 'Model configuration status' })

    expect(status.className).toContain('ready')
    expect(within(status).getByText('Ready to run')).toBeTruthy()
    expect(within(status).getByText('agent-model')).toBeTruthy()
    expect(within(status).getByText('WebDroid JSON')).toBeTruthy()
    expect(screen.queryByText('Required next')).toBeNull()
  })

  it('keeps the section badge short while the status card carries the full model state', () => {
    render(<ModelPanel {...createModelPanelProps()} />)

    const headingBadge = screen.getByText('Ready')

    expect(headingBadge.className).toContain('ready')
    expect(headingBadge.textContent).toBe('Ready')
    expect(headingBadge.textContent).not.toBe('Ready to run')
    expect(within(screen.getByRole('status', { name: 'Model configuration status' })).getByText(
      'Ready to run',
    )).toBeTruthy()
  })

  it('labels provider choices as OpenAI compatible and Qwen', () => {
    render(<ModelPanel {...createModelPanelProps()} />)

    fireEvent.click(screen.getByText('Model settings'))
    const providerSelect = screen.getByLabelText(/provider/i)

    expect(within(providerSelect).getByRole('option', { name: 'OpenAI Compatible' })).toBeTruthy()
    expect(within(providerSelect).getByRole('option', { name: 'Qwen' })).toBeTruthy()
  })

  it('ignores invalid action protocol select values', () => {
    const onActionProtocolChange = vi.fn()
    render(<ModelPanel {...createModelPanelProps({ onActionProtocolChange })} />)

    fireEvent.click(screen.getByText('Model settings'))
    fireEvent.change(screen.getByLabelText(/action protocol/i), {
      target: { value: 'invalid-protocol' },
    })

    expect(onActionProtocolChange).not.toHaveBeenCalled()
  })

  it('applies the Qwen provider preset without changing the API key', () => {
    const onModelConfigChange = vi.fn()
    render(<ModelPanel {...createModelPanelProps({ onModelConfigChange })} />)

    fireEvent.click(screen.getByText('Model settings'))
    fireEvent.change(screen.getByLabelText(/provider/i), {
      target: { value: 'qwen' },
    })

    expect(onModelConfigChange).toHaveBeenCalledWith(
      'baseUrl',
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    )
    expect(onModelConfigChange).toHaveBeenCalledWith('model', 'qwen3.7-plus')
    expect(onModelConfigChange).toHaveBeenCalledWith('provider', 'qwen')
    expect(onModelConfigChange).toHaveBeenCalledWith('reasoningEffort', undefined)
    expect(onModelConfigChange).toHaveBeenCalledWith('qwenThinkingEnabled', true)
    expect(onModelConfigChange).toHaveBeenCalledWith('qwenThinkingBudget', 300)
    expect(onModelConfigChange).not.toHaveBeenCalledWith('apiKey', expect.anything())
  })

  it('clears the provider when switching back to custom settings', () => {
    const onModelConfigChange = vi.fn()
    render(
      <ModelPanel
        {...createModelPanelProps({
          modelConfig: {
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            apiKey: 'sk-test',
            model: 'qwen3.7-plus',
            provider: 'qwen',
            qwenThinkingEnabled: true,
            qwenThinkingBudget: 300,
          },
          onModelConfigChange,
        })}
      />,
    )

    fireEvent.click(screen.getByText('Model settings'))
    fireEvent.change(screen.getByLabelText(/provider/i), {
      target: { value: 'custom' },
    })

    expect(onModelConfigChange).toHaveBeenCalledWith('provider', 'custom')
    expect(onModelConfigChange).not.toHaveBeenCalledWith('baseUrl', expect.anything())
    expect(onModelConfigChange).not.toHaveBeenCalledWith('model', expect.anything())
  })

  it('shows Qwen thinking controls instead of generic thinking depth for the Qwen preset', () => {
    const onModelConfigChange = vi.fn()
    render(
      <ModelPanel
        {...createModelPanelProps({
          modelConfig: {
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            apiKey: 'sk-test',
            model: 'qwen3.7-plus',
            provider: 'qwen',
            qwenThinkingEnabled: true,
            qwenThinkingBudget: 300,
          },
          onModelConfigChange,
        })}
      />,
    )

    fireEvent.click(screen.getByText('Model settings'))

    expect(screen.queryByLabelText(/thinking depth/i)).toBeNull()

    const thinkingMode = screen.getByLabelText(/thinking mode/i) as HTMLInputElement
    expect(thinkingMode.checked).toBe(true)

    const thinkingBudget = screen.getByLabelText(/thinking budget/i) as HTMLInputElement
    expect(thinkingBudget.value).toBe('300')

    fireEvent.click(thinkingMode)
    expect(onModelConfigChange).toHaveBeenCalledWith('qwenThinkingEnabled', false)

    fireEvent.change(thinkingBudget, { target: { value: '8192' } })
    expect(onModelConfigChange).toHaveBeenCalledWith('qwenThinkingBudget', 8192)
  })

  it('hides the Qwen thinking budget when Qwen thinking is disabled', () => {
    render(
      <ModelPanel
        {...createModelPanelProps({
          modelConfig: {
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            apiKey: 'sk-test',
            model: 'qwen3.7-plus',
            provider: 'qwen',
            qwenThinkingEnabled: false,
            qwenThinkingBudget: 300,
          },
        })}
      />,
    )

    fireEvent.click(screen.getByText('Model settings'))

    expect((screen.getByLabelText(/thinking mode/i) as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByLabelText(/thinking budget/i)).toBeNull()
  })

  it('names model settings fields for browser form diagnostics', () => {
    render(<ModelPanel {...createModelPanelProps()} />)

    fireEvent.click(screen.getByText('Model settings'))

    const form = document.querySelector('.model-settings-form')
    const providerSelect = screen.getByLabelText(/^provider$/i)
    const baseUrlInput = screen.getByLabelText(/^base url$/i)
    const apiKeyInput = screen.getByLabelText(/^api key$/i)
    const modelInput = screen.getByLabelText(/^model$/i)
    const reasoningSelect = screen.getByLabelText(/thinking depth/i)
    const actionProtocolSelect = screen.getByLabelText(/action protocol/i)
    const streamCheckbox = screen.getByLabelText(/stream model responses/i)

    expect(form?.contains(apiKeyInput)).toBe(true)
    for (const field of [
      providerSelect,
      baseUrlInput,
      apiKeyInput,
      modelInput,
      reasoningSelect,
      actionProtocolSelect,
      streamCheckbox,
    ]) {
      expect(field.getAttribute('id')).toBeTruthy()
      expect(field.getAttribute('name')).toBeTruthy()
    }
  })
})
