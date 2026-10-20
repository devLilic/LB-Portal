import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { MosMappingResolution } from '../../../src/shared/ingress/mosMappingResolution'
import type { LiveBoardExecutionReport } from '../../../src/shared/liveboard/runtime'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import MosMappingReport from '../../../src/features/ingress/MosMappingReport'

describe('MOS mapping execution report', () => {
  it('explains that RESUME uses only the template name and hides PLAY parameter diagnostics', () => {
    const mapping: MosMappingResolution = {
      status: 'matched', commandType: 'mos-resume', template: 'Plasma',
      project: { id: 'builtin-telejurnal', name: 'Telejurnal', kind: 'telejurnal' },
      section: { id: 's1', name: 'Headlines' },
      targets: [{ id: 't1', template: 'LB-1', fields: [{ param: 'Title', fields: ['TextA'], value: null }] }],
      exitMode: 'manual-resume', durationSeconds: 6, resumePlayDelayMs: 100, dataPropagationDelayMs: 250,
      missingParams: [], unmappedParams: [],
    }
    const html = renderToStaticMarkup(React.createElement(MosMappingReport, { mapping }))

    expect(html).toContain('mos.consoleMapping.resumeNoParams')
    expect(html).not.toContain('mos-report-target')
    expect(html).not.toContain('mos.consoleMapping.missingParams')
    expect(html).not.toContain('mos.consoleMapping.graphicOnly')
  })

  it('renders blocked execution details even when no mapping matched', async () => {
    const mapping: MosMappingResolution = { status: 'unmapped', template: 'unknown-template' }
    const execution: LiveBoardExecutionReport = {
      origin: 'mos-play',
      status: 'blocked',
      mode: 'simulation',
      sectionId: null,
      sectionName: null,
      sourceTemplate: 'unknown-template',
      beforeState: null,
      afterState: null,
      selectedTargetId: null,
      selectedBuffer: null,
      previousTargetId: null,
      nextBuffer: null,
      steps: [{ kind: 'play', state: 'failed', template: 'unknown-template', command: 'LBC_PLAYCONTENT "unknown-template"', error: 'No mapping found.' }],
      error: 'No mapping found.',
      confirmation: 'simulated',
    }

    const html = renderToStaticMarkup(React.createElement(MosMappingReport, { mapping, execution }))

    expect(html).toContain('liveBoard.executionStatus.blocked')
    expect(html).toContain('liveBoard.step.play')
    expect(html).toContain('LBC_PLAYCONTENT')
    expect(html).toContain('No mapping found.')
    expect(html).not.toContain('mos.consoleMapping.notExecuted')
    expect(html).not.toContain('mos-report-target')
    expect(html).not.toContain('mos.consoleMapping.section')
  })

  it('labels standalone project reports as blocked without rendering a mapped section', () => {
    const mapping: MosMappingResolution = {
      status: 'project-disabled',
      template: 'direct-template',
      project: { id: 'standalone-1', name: 'Direct operation', kind: 'standalone' },
    }
    const execution: LiveBoardExecutionReport = {
      origin: 'mos-play', projectId: 'standalone-1', projectName: 'Direct operation', projectKind: 'standalone',
      status: 'blocked', mode: 'simulation', sectionId: null, sectionName: null,
      sourceTemplate: 'direct-template', beforeState: null, afterState: null,
      selectedTargetId: null, selectedBuffer: null, previousTargetId: null, nextBuffer: null,
      steps: [{ kind: 'play', state: 'failed', template: 'direct-template', error: 'Project is standalone.' }],
      error: 'Project is standalone.', confirmation: 'simulated',
    }
    const html = renderToStaticMarkup(React.createElement(MosMappingReport, { mapping, execution }))

    expect(html).toContain('mos.consoleMapping.project-disabled')
    expect(html).toContain('Direct operation')
    expect(html).toContain('mos.projects.kind.standalone')
    expect(html).toContain('liveBoard.executionStatus.blocked')
    expect(html).toContain('Project is standalone.')
    expect(html).not.toContain('mos.consoleMapping.section')
    expect(html).not.toContain('mos-report-target')
  })
})
