import { env } from '@main/env'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { createBackup } from './local'

/**
 * Uploads a copy of the one database file to Google Drive, replacing the previous copy.
 * Note: Planned feature; nothing calls this yet, so no copy leaves the computer.
 */
export async function backupDatabase(): Promise<void> {
  const snapshot = await createBackup()
  const { drive } = await import('@main/google/drive')
  const { data } = await drive.files.list({
    q: `name = '${env.DRIVE_BACKUP_NAME}' and trashed = false`,
    fields: 'files(id)'
  })

  const fileId = data.files?.[0]?.id

  const media = {
    mimeType: 'application/octet-stream',
    body: createReadStream(join(snapshot.directory, 'database.sqlite'))
  }

  if (fileId) {
    await drive.files.update({
      fileId,
      media
    })
  } else {
    await drive.files.create({
      requestBody: { name: env.DRIVE_BACKUP_NAME },
      media
    })
  }
}
