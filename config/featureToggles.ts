import type { AppConfig, FeatureConfig } from './types'

export type FeatureKey = keyof FeatureConfig

export function isFeatureEnabled(config: AppConfig, feature: FeatureKey): boolean {
  return config.features[feature]
}

export function getEnabledFeatures(config: AppConfig): FeatureKey[] {
  return (Object.keys(config.features) as FeatureKey[]).filter((feature) =>
    isFeatureEnabled(config, feature),
  )
}
