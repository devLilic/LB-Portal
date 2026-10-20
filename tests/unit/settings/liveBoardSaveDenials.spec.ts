import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const codes = ['LIVEBOARD_BUSY', 'MOS_MAPPINGS_ACTIVE', 'LIVEBOARD_CONNECTION_ACTIVE'] as const

describe('localized LiveBoard save denials', () => {
  for (const language of ['en', 'ro', 'ru']) {
    it(`provides an actionable message for every expected denial in ${language}`, () => {
      const path = resolve(process.cwd(), `src/i18n/locales/${language}/settings.json`)
      const messages = JSON.parse(readFileSync(path, 'utf8')).liveBoard.saveDenied as Record<string, string>

      for (const code of codes) {
        expect(messages[code]).toBeTruthy()
        if (code !== 'LIVEBOARD_BUSY') expect(messages[code]).toContain('{{sections}}')
      }
    })
  }
})
