import { describe, expect, it } from 'vitest'
import { getMosMappingIssues, validateMosMappings } from '../../../src/shared/settings/mosMappings'
import { createSettingsStore } from '../../../electron/main/modules/settings/settingsStore'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getActiveMosProject } from '../../../src/shared/settings/mosProjects'

const valid = {
  version: 1 as const,
  sections: [{
    id: 'section-1', name: 'News', resumePlayDelayMs: 50,
    targets: [{ id: 'target-1', template: 'out-a' }, { id: 'target-2', template: 'out-b' }],
    sources: [{ id: 'source-1', template: 'in-a', exitMode: 'manual-resume' as const, durationSeconds: 10,
      fields: [{ id: 'field-1', param: 'Title', targetFields: { 'target-1': 'Title', 'target-2': 'Headline' } }] }],
  }],
}

describe('MOS mapping validation', () => {
  it('accepts a complete mapping and preserves entered spelling', () => {
    expect(validateMosMappings(valid)).toEqual(valid)
  })

  it('accepts a graphic only source and template duration mode', () => {
    const graphicOnly: any = structuredClone(valid)
    graphicOnly.sections[0].sources[0].fields = []
    graphicOnly.sections[0].sources[0].exitMode = 'template-duration'
    graphicOnly.sections[0].sources[0].durationSeconds = 6
    expect(validateMosMappings(graphicOnly)).toEqual(graphicOnly)
  })

  it('rejects target field references left behind after a target is removed', () => {
    const stale: any = structuredClone(valid)
    stale.sections[0].sources[0].fields[0].targetFields['old-target'] = 'Title'
    expect(getMosMappingIssues(stale).some((entry) => entry.code === 'invalidStructure')).toBe(true)
  })

  it.each([
    ['blank section name', 'required', (config: any) => { config.sections[0].name = '  ' }],
    ['zero automatic duration', 'invalidDuration', (config: any) => { config.sections[0].sources[0].exitMode = 'template-duration'; config.sections[0].sources[0].durationSeconds = 0 }],
    ['unsupported transition delay', 'invalidDelay', (config: any) => { config.sections[0].resumePlayDelayMs = 42 }],
    ['more than two buffers', 'invalidStructure', (config: any) => { config.sections[0].targets.push({ id: 'target-3', template: 'out-c' }) }],
    ['no destination', 'invalidStructure', (config: any) => { config.sections[0].targets = [] }],
  ] as const)('rejects %s', (_description, code, change) => {
    const invalid = structuredClone(valid)
    change(invalid)
    expect(getMosMappingIssues(invalid).some((entry) => entry.code === code)).toBe(true)
    expect(() => validateMosMappings(invalid)).toThrow()
  })

  it('allows source parameters with no destination and several fields in one destination', () => {
    const partial: any = structuredClone(valid)
    partial.sections[0].sources[0].fields[0].targetFields = { 'target-1': ['Title', 'Title_M'], 'target-2': [] }
    partial.sections[0].sources[0].fields.push({ id: 'field-2', param: 'Unused', targetFields: { 'target-1': [], 'target-2': [] } })
    expect(validateMosMappings(partial)).toEqual(partial)
  })

  it('persists and reloads stable IDs and exact template spelling across a rename', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mos-settings-reload-'))
    try {
      const store = createSettingsStore(dir)
      store.setSetting('mosMappings', valid)
      const renamed = structuredClone(valid)
      renamed.sections[0].name = 'Breaking News'
      renamed.sections[0].targets[0].template = 'OUT-A'
      store.setSetting('mosMappings', renamed)
      const reloaded = getActiveMosProject(createSettingsStore(dir).getSetting('mosMappings')).mappings
      expect(reloaded.sections[0].id).toBe('section-1')
      expect(reloaded.sections[0].targets[0]).toEqual({ id: 'target-1', template: 'OUT-A' })
      expect(reloaded.sections[0].sources[0].fields[0].targetFields).toEqual({ 'target-1': 'Title', 'target-2': 'Headline' })
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('reports duplicate templates and destination fields while allowing repeated source params', () => {
    const invalid = structuredClone(valid)
    invalid.sections[0].sources[0].fields.push({ id: 'field-2', param: 'Title', targetFields: { 'target-1': 'Title', 'target-2': 'Other' } })
    invalid.sections[0].sources.push({ ...invalid.sections[0].sources[0], id: 'source-2' })
    invalid.sections[0].targets.push({ id: 'target-3', template: 'out-a' })
    const codes = getMosMappingIssues(invalid).map((entry) => entry.code)
    expect(codes).not.toContain('duplicateParam')
    expect(codes).toContain('duplicateField')
    expect(codes).toContain('duplicateSource')
    expect(codes).toContain('duplicateTarget')
  })

  it('rejects malformed values and does not overwrite persisted settings', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mos-settings-'))
    try {
      const store = createSettingsStore(dir)
      store.setSetting('language', 'ru')
      const before = readFileSync(path.join(dir, 'settings.json'), 'utf8')
      expect(() => store.setSetting('mosMappings', { version: 1, sections: [{ ...valid.sections[0], sources: [] }] })).toThrow()
      expect(readFileSync(path.join(dir, 'settings.json'), 'utf8')).toBe(before)
      expect(store.getSetting('language')).toBe('ru')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('preserves malformed persisted mappings and unrelated settings, while MOS access fails', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mos-settings-corrupt-'))
    const file = path.join(dir, 'settings.json')
    const persisted = { language: 'ru', mosMappings: { version: 1, sections: 'broken' } }
    try {
      writeFileSync(file, JSON.stringify(persisted), 'utf8')
      const store = createSettingsStore(dir)
      expect(store.getSetting('language')).toBe('ru')
      expect(() => store.getSetting('mosMappings')).toThrow()
      store.setSetting('language', 'en')
      expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ language: 'en', mosMappings: persisted.mosMappings })
      const beforeMappingSave = readFileSync(file, 'utf8')
      expect(() => store.setSetting('mosMappings', valid)).toThrow()
      expect(readFileSync(file, 'utf8')).toBe(beforeMappingSave)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('does not overwrite a malformed settings file through MOS mapping save', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mos-settings-json-corrupt-'))
    const file = path.join(dir, 'settings.json')
    try {
      writeFileSync(file, '{invalid json', 'utf8')
      const before = readFileSync(file, 'utf8')
      expect(() => createSettingsStore(dir).getSetting('mosMappings')).toThrow()
      expect(() => createSettingsStore(dir).setSetting('mosMappings', valid)).toThrow()
      expect(readFileSync(file, 'utf8')).toBe(before)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
