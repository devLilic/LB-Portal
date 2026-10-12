import type { FeatureConfig } from '../../config/types'

export const starterModuleIds = [
  'i18n',
  'autoUpdate',
  'appProtection',
  'licensing',
  'database',
  'logging',
] as const

export type StarterModuleId = (typeof starterModuleIds)[number]

export interface StarterModuleOption {
  id: StarterModuleId
  label: string
  description: string
}

export interface StarterInitInputValues {
  appName: string
  appId: string
  packageName: string
  displayName: string
  initialEnabledModules: StarterModuleId[]
}

export type StarterInitInputKey = keyof StarterInitInputValues

export interface StarterInitInputDefinition<
  Key extends StarterInitInputKey = StarterInitInputKey,
> {
  key: Key
  label: string
  description: string
  required: boolean
  kind: Key extends 'initialEnabledModules' ? 'module-multiselect' : 'text'
  defaultValue: StarterInitInputValues[Key]
}

export type StarterFeatureSelection = FeatureConfig
