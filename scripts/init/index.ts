import type { StarterFeatureSelection, StarterModuleId } from './types'

export { starterInitInputDefinitions, starterModuleOptions } from './definitions'
export {
  generateAppId,
  normalizeAppName,
  normalizeDisplayName,
  normalizePackageName,
  resolveStarterInitValues,
} from './transform'
export type {
  StarterFeatureSelection,
  StarterInitInputDefinition,
  StarterInitInputKey,
  StarterInitInputValues,
  StarterModuleId,
  StarterModuleOption,
} from './types'
export { starterModuleIds } from './types'

export function resolveStarterFeatureSelection(
  enabledModules: readonly StarterModuleId[],
): StarterFeatureSelection {
  const enabledModuleSet = new Set(enabledModules)

  return {
    i18n: enabledModuleSet.has('i18n'),
    autoUpdate: enabledModuleSet.has('autoUpdate'),
    appProtection: enabledModuleSet.has('appProtection'),
    licensing: enabledModuleSet.has('licensing'),
    database: enabledModuleSet.has('database'),
    logging: enabledModuleSet.has('logging'),
  }
}
