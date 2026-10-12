import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'

describe('auto update config', () => {
  it('defaults to detect and manual download for github releases', () => {
    const config = loadConfig('production', {})

    expect(config.update.provider.provider).toBe('github')
    expect(config.update.provider.visibility).toBe('public')
    expect(config.update.autoCheck).toBe(true)
    expect(config.update.autoDownload).toBe(false)
  })

  it('applies github releases env overrides', () => {
    const config = loadConfig('production', {
      APP_FEATURE_AUTO_UPDATE: 'true',
      APP_UPDATE_OWNER: 'acme',
      APP_UPDATE_REPO: 'starter',
      APP_UPDATE_VISIBILITY: 'private',
      APP_UPDATE_AUTO_CHECK: 'false',
      APP_UPDATE_AUTO_DOWNLOAD: 'true',
    })

    expect(config.update.enabled).toBe(true)
    expect(config.update.provider.owner).toBe('acme')
    expect(config.update.provider.repo).toBe('starter')
    expect(config.update.provider.visibility).toBe('private')
    expect(config.update.autoCheck).toBe(false)
    expect(config.update.autoDownload).toBe(true)
  })
})
