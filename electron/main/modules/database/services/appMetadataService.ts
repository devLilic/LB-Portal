import type {
  AppMetadataRecord,
  AppMetadataRepository,
} from '../repositories/appMetadataRepository'

export interface AppMetadataService {
  getValue: (key: string) => Promise<string | null>
  setValue: (key: string, value: string | null) => Promise<AppMetadataRecord>
}

export function createAppMetadataService(
  repository: AppMetadataRepository,
): AppMetadataService {
  return {
    async getValue(key) {
      const record = await repository.getByKey(key)
      return record?.value ?? null
    },
    async setValue(key, value) {
      return repository.upsert({
        key,
        value,
        updatedAt: new Date(),
      })
    },
  }
}
