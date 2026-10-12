import { eq } from 'drizzle-orm'
import { appMetadata } from '../schema'
import type { DatabaseConnection } from '../types'

export interface AppMetadataRecord {
  key: string
  value: string | null
  updatedAt: Date
}

export interface AppMetadataRepository {
  getByKey: (key: string) => Promise<AppMetadataRecord | null>
  upsert: (record: { key: string; value: string | null; updatedAt: Date }) => Promise<AppMetadataRecord>
}

export function createAppMetadataRepository(
  connection: DatabaseConnection,
): AppMetadataRepository {
  return {
    async getByKey(key) {
      const record = connection.db
        .select()
        .from(appMetadata)
        .where(eq(appMetadata.key, key))
        .get()

      if (!record) {
        return null
      }

      return {
        key: record.key,
        value: record.value,
        updatedAt: record.updatedAt,
      }
    },
    async upsert(record) {
      connection.db
        .insert(appMetadata)
        .values(record)
        .onConflictDoUpdate({
          target: appMetadata.key,
          set: {
            value: record.value,
            updatedAt: record.updatedAt,
          },
        })
        .run()

      return {
        key: record.key,
        value: record.value,
        updatedAt: record.updatedAt,
      }
    },
  }
}
