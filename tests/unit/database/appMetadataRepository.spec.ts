import { describe, expect, it } from 'vitest'
import { createInMemoryDatabaseConnection } from '../../../electron/main/modules/database'
import { createAppMetadataRepository } from '../../../electron/main/modules/database/repositories'

describe('app metadata repository', () => {
  it('upserts and reads metadata records', async () => {
    const connection = await createInMemoryDatabaseConnection()
    const repository = createAppMetadataRepository(connection)
    const updatedAt = new Date('2026-03-27T12:00:00.000Z')

    connection.client
      .prepare(
        `
          create table if not exists app_metadata (
            key text primary key,
            value text,
            updated_at integer not null
          )
        `,
      )
      .run()

    await repository.upsert({
      key: 'app.theme',
      value: 'dark',
      updatedAt,
    })

    await expect(repository.getByKey('app.theme')).resolves.toEqual({
      key: 'app.theme',
      value: 'dark',
      updatedAt,
    })

    connection.close()
  })
})
