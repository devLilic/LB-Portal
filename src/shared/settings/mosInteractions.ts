import type { MosMappingConfig } from './mosMappings'

export type MosInteractionEvent = 'before-play' | 'after-resume' | 'after-stop' | 'after-auto-exit'
export type MosInteractionActionKind = 'resume' | 'stop' | 'suspend' | 'play'
export type MosInteractionRestoreOn = 'auto-exit' | 'resume' | 'stop' | 'any-exit'

export interface MosInteractionAction {
  id: string
  kind: MosInteractionActionKind
  sectionId: string
  targetId?: string
  delayMs: number
  restoreOn?: MosInteractionRestoreOn
}

export interface MosInteractionRule {
  id: string
  name: string
  enabled: boolean
  triggerSectionId: string
  event: MosInteractionEvent
  actions: MosInteractionAction[]
}

export interface MosInteractionIssue {
  code: string
  path: string
}

const events: readonly MosInteractionEvent[] = ['before-play', 'after-resume', 'after-stop', 'after-auto-exit']
const actionKinds: readonly MosInteractionActionKind[] = ['resume', 'stop', 'suspend', 'play']
const restoreEvents: readonly MosInteractionRestoreOn[] = ['auto-exit', 'resume', 'stop', 'any-exit']

/** Returns path-addressable interaction validation errors for settings editors. */
export function getMosInteractionIssues(value: unknown, mappings: MosMappingConfig): MosInteractionIssue[] {
  const issues: MosInteractionIssue[] = []
  const issue = (code: string, path: string) => issues.push({ code, path })
  if (value === undefined) return issues
  if (!Array.isArray(value)) return [{ code: 'invalidStructure', path: 'interactions' }]

  const sections = new Map<string, MosMappingConfig['sections'][number]>()
  for (const section of mappings.sections) sections.set(section.id, section)
  const ids = new Set<string>()
  const enabledDestinations = new Map<string, Set<string>>()

  const addId = (raw: unknown, path: string) => {
    if (typeof raw !== 'string' || !raw.trim()) {
      issue('required', path)
      return undefined
    }
    if (ids.has(raw)) issue('duplicateId', path)
    ids.add(raw)
    return raw
  }

  value.forEach((rawRule: unknown, ri: number) => {
    const rp = `interactions[${ri}]`
    if (!isRecord(rawRule) || !Array.isArray(rawRule.actions)) {
      issue('invalidStructure', rp)
      return
    }
    const rule = rawRule
    const ruleId = addId(rule.id, `${rp}.id`)
    if (typeof rule.name !== 'string' || !rule.name.trim()) issue('required', `${rp}.name`)
    if (typeof rule.enabled !== 'boolean') issue('invalidStructure', `${rp}.enabled`)
    const triggerSectionId = addReference(rule.triggerSectionId, sections, issue, `${rp}.triggerSectionId`)
    if (typeof rule.event !== 'string' || !events.includes(rule.event as MosInteractionEvent)) issue('invalidStructure', `${rp}.event`)
    if (rule.actions.length === 0) issue('invalidStructure', `${rp}.actions`)

    const sameRuleActions = new Set<string>()
    const kindsByDestination = new Map<string, Set<string>>()
    const destinations = new Set<string>()
    rule.actions.forEach((rawAction: unknown, ai: number) => {
      const ap = `${rp}.actions[${ai}]`
      if (!isRecord(rawAction)) {
        issue('invalidStructure', ap)
        return
      }
      const action = rawAction
      addId(action.id, `${ap}.id`)
      if (typeof action.kind !== 'string' || !actionKinds.includes(action.kind as MosInteractionActionKind)) issue('invalidStructure', `${ap}.kind`)
      const kind = action.kind as MosInteractionActionKind
      const sectionId = addReference(action.sectionId, sections, issue, `${ap}.sectionId`)
      if (typeof action.delayMs !== 'number' || !Number.isInteger(action.delayMs) || action.delayMs < 0 || action.delayMs > 60000) issue('invalidDelay', `${ap}.delayMs`)

      if (kind === 'play') {
        if (typeof action.targetId !== 'string' || !action.targetId.trim()) issue('required', `${ap}.targetId`)
        else if (sectionId && !sections.get(sectionId)?.targets.some(target => target.id === action.targetId)) issue('invalidReference', `${ap}.targetId`)
      } else if (action.targetId !== undefined) {
        issue('unexpectedField', `${ap}.targetId`)
      }
      if (kind === 'suspend') {
        if (rule.event !== 'before-play') issue('invalidEvent', `${rp}.event`)
        if (action.restoreOn !== undefined && (typeof action.restoreOn !== 'string' || !restoreEvents.includes(action.restoreOn as MosInteractionRestoreOn))) issue('invalidStructure', `${ap}.restoreOn`)
      } else if (action.restoreOn !== undefined) {
        issue('unexpectedField', `${ap}.restoreOn`)
      }

      if (!sectionId) return
      destinations.add(sectionId)
      // A rule action does not dispatch another interaction event. Cross-rule
      // section paths therefore are not execution cycles; only direct
      // self-references are invalid.
      if (triggerSectionId === sectionId) issue('interactionCycle', ap)
      const signature = `${kind}\u0000${sectionId}\u0000${typeof action.targetId === 'string' ? action.targetId : ''}`
      if (sameRuleActions.has(signature)) issue('duplicateAction', ap)
      sameRuleActions.add(signature)
      let kinds = kindsByDestination.get(sectionId)
      if (!kinds) { kinds = new Set(); kindsByDestination.set(sectionId, kinds) }
      kinds.add(kind)
    })

    for (const [sectionId, kinds] of kindsByDestination) {
      if (kinds.has('suspend') && (kinds.has('stop') || kinds.has('play'))) {
        issue('conflictingActions', `${rp}.actions`)
      }
    }
    if (rule.enabled === true && triggerSectionId && typeof rule.event === 'string' && events.includes(rule.event as MosInteractionEvent)) {
      for (const destination of destinations) {
        const key = `${triggerSectionId}\u0000${rule.event}\u0000${destination}`
        if (enabledDestinations.has(key)) issue('duplicateEventTarget', `${rp}.actions`)
        enabledDestinations.set(key, new Set([ruleId ?? '']))
      }
    }
  })

  return issues
}

export function validateMosInteractions(value: unknown, mappings: MosMappingConfig): MosInteractionRule[] {
  const issues = getMosInteractionIssues(value, mappings)
  if (issues.length) throw new Error(`Invalid MOS interactions: ${issues.map(({ code, path }) => `${code} at ${path}`).join(', ')}`)
  if (value === undefined) return []
  return (value as MosInteractionRule[]).map(rule => ({
    ...rule,
    actions: rule.actions.map(action => action.kind === 'suspend' ? { ...action, restoreOn: action.restoreOn ?? 'auto-exit' } : action),
  }))
}

function addReference(
  raw: unknown,
  sections: Map<string, MosMappingConfig['sections'][number]>,
  issue: (code: string, path: string) => void,
  path: string,
): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) {
    issue('required', path)
    return undefined
  }
  if (!sections.has(raw)) {
    issue('invalidReference', path)
    return undefined
  }
  return raw
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
