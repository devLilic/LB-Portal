import { describe, expect, it, vi } from 'vitest'
import { createAppMetadataService } from '../../../electron/main/modules/database/services'

describe('app metadata service', () => {
  it('returns null when metadata is missing', async () => {
    const service = createAppMetadataService({
      getByKey: vi.fn(async () => null),
      upsert: vi.fn(),
    })

    await expect(service.getValue('app.theme')).resolves.toBeNull()
  })

  it('persists metadata values through the repository', async () => {
    const upsert = vi.fn(async (record: { key: string; value: string | null; updatedAt: Date }) => record)
    const service = createAppMetadataService({
      getByKey: vi.fn(),
      upsert,
    })

    const result = await service.setValue('app.theme', 'dark')

    expect(upsert).toHaveBeenCalledWith({
      key: 'app.theme',
      value: 'dark',
      updatedAt: expect.any(Date),
    })
    expect(result.key).toBe('app.theme')
    expect(result.value).toBe('dark')
  })
})
