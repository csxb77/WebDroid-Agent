import type { DeviceBackend, ExecuteActionOptions } from '../adapters/deviceTypes'
import {
  evaluateActionSafety,
  type ActionSafetyContext,
  type ActionSafetyDecision,
} from './actionSafetyPolicy'
import type { AgentAction } from './actionTypes'

export type ActionToolParameter = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'list'
  required?: boolean
  description?: string
  default?: unknown
}

export type ActionToolSignature = {
  description: string
  parameters: Record<string, ActionToolParameter>
}

export type ActionToolResult = {
  toolName: string
  success: boolean
  summary: string
  safetyDecision?: Exclude<ActionSafetyDecision, 'allow'>
}

export type ActionToolContext = {
  device: DeviceBackend
  confirmSensitiveAction?: ExecuteActionOptions['confirmSensitiveAction']
  safetyContext?: ActionSafetyContext
}

type ActionToolName = AgentAction['action']

type ActionToolEntry<Action extends AgentAction = AgentAction> = ActionToolSignature & {
  execute: (action: Action, context: ActionToolContext) => Promise<string> | string
}

const DEFAULT_ACTION_TOOL_SIGNATURES: Partial<Record<ActionToolName, ActionToolSignature>> = {
  launch: {
    description: 'Launch an Android app by common app name or package name.',
    parameters: {
      app: { type: 'string', required: true, description: 'Common app name or package name.' },
      packageName: { type: 'string', required: false, description: 'Resolved Android package name.' },
    },
  },
  tap: {
    description: 'Tap a screen coordinate.',
    parameters: {
      x: { type: 'number', required: true, description: 'Horizontal screen coordinate.' },
      y: { type: 'number', required: true, description: 'Vertical screen coordinate.' },
      message: { type: 'string', required: false, description: 'Optional confirmation message.' },
      risk: { type: 'string', required: false, description: 'Set to sensitive for risky taps.' },
    },
  },
  swipe: {
    description: 'Swipe from one screen coordinate to another.',
    parameters: {
      fromX: { type: 'number', required: true },
      fromY: { type: 'number', required: true },
      toX: { type: 'number', required: true },
      toY: { type: 'number', required: true },
      durationMs: { type: 'number', required: false, default: 400 },
    },
  },
  input_text: {
    description: 'Type text into the focused field, optionally clearing the field first.',
    parameters: {
      text: { type: 'string', required: true, description: 'Text to input.' },
      clear: {
        type: 'boolean',
        required: false,
        default: false,
        description: 'Clear the currently focused field before typing.',
      },
    },
  },
  key: {
    description: 'Send an Android key event.',
    parameters: {
      key: { type: 'string', required: true, description: 'Supported Android key alias.' },
    },
  },
  back: {
    description: 'Press Android Back.',
    parameters: {},
  },
  home: {
    description: 'Press Android Home.',
    parameters: {},
  },
  long_press: {
    description: 'Long-press a screen coordinate.',
    parameters: {
      x: { type: 'number', required: true },
      y: { type: 'number', required: true },
      durationMs: { type: 'number', required: true },
    },
  },
  double_tap: {
    description: 'Double-tap a screen coordinate.',
    parameters: {
      x: { type: 'number', required: true },
      y: { type: 'number', required: true },
    },
  },
  wait: {
    description: 'Wait without touching the device.',
    parameters: {
      ms: { type: 'number', required: true, description: 'Milliseconds to wait.' },
    },
  },
  take_over: {
    description: 'Ask the user to take over manually.',
    parameters: {
      message: { type: 'string', required: true },
    },
  },
  note: {
    description: 'Record an observation without touching the device.',
    parameters: {
      message: { type: 'string', required: true },
    },
  },
  done: {
    description: 'Mark the task as complete.',
    parameters: {
      summary: { type: 'string', required: false },
    },
  },
}

export class ActionToolRegistry {
  #tools = new Map<ActionToolName, ActionToolEntry>()
  #disabled = new Set<ActionToolName>()

  constructor(disabledTools: readonly ActionToolName[] = []) {
    this.#disabled = new Set(disabledTools)
  }

  register<Action extends AgentAction>(
    name: Action['action'],
    entry: ActionToolEntry<Action>,
  ) {
    this.#tools.set(name, entry as ActionToolEntry)
  }

  disable(toolNames: readonly ActionToolName[]) {
    for (const name of toolNames) {
      this.#disabled.add(name)
    }
  }

  getSignatures(exclude: readonly ActionToolName[] = []) {
    const excluded = new Set(exclude)
    return Object.fromEntries(
      [...this.#tools.entries()]
        .filter(([name]) => !excluded.has(name) && !this.#disabled.has(name))
        .map(([name, entry]) => [
          name,
          {
            description: entry.description,
            parameters: entry.parameters,
          },
        ]),
    ) as Record<ActionToolName, ActionToolSignature>
  }

  async execute(action: AgentAction, context: ActionToolContext): Promise<ActionToolResult> {
    const toolName = action.action
    if (action.action === 'interact') {
      return {
        toolName,
        success: false,
        summary: action.message,
        safetyDecision: 'take_over',
      }
    }
    if (action.action === 'call_api') {
      return {
        toolName,
        success: false,
        summary: `Unsupported call_api action: ${action.instruction}`,
        safetyDecision: 'take_over',
      }
    }

    const entry = this.#tools.get(toolName)
    if (!entry) {
      return {
        toolName,
        success: false,
        summary: `Unknown tool: ${toolName}.`,
      }
    }

    if (this.#disabled.has(toolName)) {
      return {
        toolName,
        success: false,
        summary: `Tool "${toolName}" is disabled.`,
      }
    }

    const safety = evaluateActionSafety(action, context.safetyContext)
    if (safety.decision === 'block' || safety.decision === 'take_over') {
      return {
        toolName,
        success: false,
        summary: safety.message ?? `Safety policy stopped ${toolName}.`,
        safetyDecision: safety.decision,
      }
    }

    let safetyConfirmed = false
    if (safety.decision === 'confirm') {
      const message = safety.message ?? `Safety policy requires confirmation before ${toolName}.`
      const confirmed = context.confirmSensitiveAction
        ? await context.confirmSensitiveAction(message, action)
        : false
      if (!confirmed) {
        return {
          toolName,
          success: false,
          summary: `Sensitive action blocked: ${message}`,
          safetyDecision: 'confirm',
        }
      }
      safetyConfirmed = true
    }

    try {
      const summary = await entry.execute(action, {
        ...context,
        confirmSensitiveAction: safetyConfirmed ? () => true : context.confirmSensitiveAction,
      })
      return {
        toolName,
        success: true,
        summary,
      }
    } catch (caught) {
      return {
        toolName,
        success: false,
        summary: caught instanceof Error ? caught.message : String(caught),
      }
    }
  }
}

export function createDefaultActionToolRegistry(disabledTools: readonly ActionToolName[] = []) {
  const registry = new ActionToolRegistry(disabledTools)

  for (const [name, signature] of Object.entries(DEFAULT_ACTION_TOOL_SIGNATURES)) {
    registry.register(name as ActionToolName, {
      ...signature,
      execute: (action, context) =>
        context.device.execute(action, {
          confirmSensitiveAction: context.confirmSensitiveAction,
        }),
    })
  }

  return registry
}
