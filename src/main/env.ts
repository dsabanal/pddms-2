import 'dotenv/config'
import electron from 'electron'
import { join, resolve } from 'node:path'
import * as z from 'zod'

/**
 * The app keeps all of its data in ONE SQLite database file, DATABASE. There is no second
 * database: backups are copies of that same file, and DRIVE_BACKUP_NAME is only the file name a
 * copy would get on Google Drive (that upload is planned and not switched on).
 */
const envSchema = z.strictObject({
  DATABASE: z.string().nonempty(),
  DRIVE_BACKUP_NAME: z.string().nonempty()
})

export type Env = z.infer<typeof envSchema>

const packagedDefault = !process.env.DATABASE && electron.app?.isPackaged
export const legacyDatabase = packagedDefault ? resolve('pddms.db') : undefined

export const env: Env = envSchema.parse({
  DATABASE:
    process.env.DATABASE ??
    (packagedDefault ? join(electron.app.getPath('userData'), 'pddms.db') : './pddms.db'),
  DRIVE_BACKUP_NAME: process.env.DRIVE_BACKUP_NAME ?? 'pddms-backup.sqlite'
} satisfies Partial<Env>)
