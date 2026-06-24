export type ConfigTarget = 'model' | 'device' | 'tools' | 'options'

export const CONFIG_TARGET_IDS: Record<ConfigTarget, string> = {
  device: 'config-device',
  model: 'config-model',
  options: 'config-options',
  tools: 'config-tools',
}
