import { describe, expect, it } from 'vitest'
import { getMosInteractionIssues, validateMosInteractions, type MosInteractionRule } from '../../../src/shared/settings/mosInteractions'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'

const mappings: MosMappingConfig = {
  version: 1,
  sections: [
    { id: 'one', name: 'One', targets: [{ id: 'one-target', template: 'OUT-1' }], resumePlayDelayMs: 100, sources: [] },
    { id: 'two', name: 'Two', targets: [{ id: 'two-target', template: 'OUT-2' }], resumePlayDelayMs: 100, sources: [] },
    { id: 'three', name: 'Three', targets: [{ id: 'three-target', template: 'OUT-3' }], resumePlayDelayMs: 100, sources: [] },
  ],
}

const rule = (overrides: Partial<MosInteractionRule> = {}): MosInteractionRule => ({
  id: 'rule-1',
  name: 'Coordinate sections',
  enabled: true,
  triggerSectionId: 'one',
  event: 'before-play',
  actions: [
    { id: 'action-1', kind: 'suspend', sectionId: 'two', delayMs: 25 },
    { id: 'action-2', kind: 'resume', sectionId: 'three', delayMs: 0 },
    { id: 'action-3', kind: 'play', sectionId: 'three', targetId: 'three-target', delayMs: 10 },
  ],
  ...overrides,
})

describe('MOS section interactions', () => {
  it('accepts ordered actions and fills the suspend restore default', () => {
    const validated = validateMosInteractions([rule()], mappings)
    expect(validated[0].actions[0].restoreOn).toBe('auto-exit')
    expect(validated[0].actions.slice(1).map(action => action.kind)).toEqual(['resume', 'play'])
  })

  it('accepts all supported suspend restore triggers', () => {
    for (const restoreOn of ['auto-exit', 'resume', 'stop', 'any-exit'] as const) {
      expect(validateMosInteractions([rule({ actions: [{ id: 'action-1', kind: 'suspend', sectionId: 'two', delayMs: 0, restoreOn }] })], mappings)[0].actions[0].restoreOn).toBe(restoreOn)
    }
  })

  it('rejects missing project references and a play target outside the destination section', () => {
    const issues = getMosInteractionIssues([rule({ actions: [{ id: 'action-1', kind: 'play', sectionId: 'two', targetId: 'three-target', delayMs: 0 }] })], mappings)
    expect(issues).toContainEqual({ code: 'invalidReference', path: 'interactions[0].actions[0].targetId' })
    expect(getMosInteractionIssues([rule({ triggerSectionId: 'missing' })], mappings)).toContainEqual({ code: 'invalidReference', path: 'interactions[0].triggerSectionId' })
  })

  it('rejects invalid delays, non-play targets, and suspend outside before-play', () => {
    const issues = getMosInteractionIssues([rule({ event: 'after-stop', actions: [
      { id: 'action-1', kind: 'suspend', sectionId: 'two', delayMs: -1 },
      { id: 'action-2', kind: 'resume', sectionId: 'three', targetId: 'three-target', delayMs: 60001 },
    ] })], mappings)
    expect(issues).toContainEqual({ code: 'invalidEvent', path: 'interactions[0].event' })
    expect(issues).toContainEqual({ code: 'invalidDelay', path: 'interactions[0].actions[0].delayMs' })
    expect(issues).toContainEqual({ code: 'invalidDelay', path: 'interactions[0].actions[1].delayMs' })
    expect(issues).toContainEqual({ code: 'unexpectedField', path: 'interactions[0].actions[1].targetId' })
  })

  it('rejects duplicate ids, duplicate actions, and incompatible suspend with stop or play', () => {
    const issues = getMosInteractionIssues([rule({ actions: [
      { id: 'action-1', kind: 'suspend', sectionId: 'two', delayMs: 0 },
      { id: 'action-1', kind: 'stop', sectionId: 'two', delayMs: 0 },
      { id: 'action-3', kind: 'stop', sectionId: 'two', delayMs: 0 },
      { id: 'action-4', kind: 'play', sectionId: 'two', targetId: 'two-target', delayMs: 0 },
    ] })], mappings)
    expect(issues.filter(item => item.code === 'duplicateId')).toHaveLength(1)
    expect(issues).toContainEqual({ code: 'duplicateAction', path: 'interactions[0].actions[2]' })
    expect(issues).toContainEqual({ code: 'conflictingActions', path: 'interactions[0].actions' })
  })

  it('rejects self links even when a rule is disabled', () => {
    const self = rule({ enabled: false, actions: [{ id: 'action-1', kind: 'stop', sectionId: 'one', delayMs: 0 }] })
    expect(getMosInteractionIssues([self], mappings).some(item => item.code === 'interactionCycle')).toBe(true)

    const reciprocalBeforePlayRules = [
      rule({ actions: [{ id: 'action-1', kind: 'resume', sectionId: 'two', delayMs: 0 }] }),
      rule({ id: 'rule-2', triggerSectionId: 'two', actions: [{ id: 'action-2', kind: 'resume', sectionId: 'one', delayMs: 0 }] }),
    ]
    expect(getMosInteractionIssues(reciprocalBeforePlayRules, mappings)).not.toContainEqual(expect.objectContaining({ code: 'interactionCycle' }))
  })

  it('rejects overlapping enabled rules with the same trigger, event, and destination', () => {
    const first = rule({ actions: [{ id: 'action-1', kind: 'stop', sectionId: 'two', delayMs: 0 }] })
    const second = rule({ id: 'rule-2', actions: [{ id: 'action-2', kind: 'resume', sectionId: 'two', delayMs: 0 }] })
    expect(getMosInteractionIssues([first, second], mappings)).toContainEqual({ code: 'duplicateEventTarget', path: 'interactions[1].actions' })
    expect(getMosInteractionIssues([first, { ...second, enabled: false }], mappings)).not.toContainEqual(expect.objectContaining({ code: 'duplicateEventTarget' }))
  })
})
