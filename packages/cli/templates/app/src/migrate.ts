import 'dotenv/config'
import { createApp } from '@feathers-baas/core'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = await createApp()
const knex = app.get('knex')

if (!knex) {
  console.log('MongoDB — schemaless, skipping migrations')
  process.exit(0)
}

// In production the migrations are compiled alongside this file in dist/migrations/
const migrationsDir = resolve(__dirname, 'migrations')

const [batchNo, ran] = (await knex.migrate.latest({ directory: migrationsDir })) as [number, string[]]

if (!ran || ran.length === 0) {
  console.log('Migrations: already up to date')
} else {
  console.log(`Migrations: batch ${batchNo}, ${ran.length} file(s)`)
  for (const m of ran) console.log(`  ✓ ${m}`)
}

await knex.destroy()
process.exit(0)
