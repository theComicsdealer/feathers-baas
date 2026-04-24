import { defineConfig } from 'tsup'
import { existsSync, readdirSync } from 'node:fs'

// Include any migration files that exist at build time so they land in
// dist/migrations/ alongside the compiled app — no TypeScript runtime needed
// in production. MongoDB projects have no migrations/ directory; the check
// below handles that gracefully.
const migrationFiles = existsSync('./migrations')
  ? readdirSync('./migrations').filter((f) => f.endsWith('.ts')).map((f) => `migrations/${f}`)
  : []

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/migrate.ts', 'src/seed.ts'],
    format: ['esm'],
    splitting: false,
    clean: true,
    sourcemap: true,
  },
  ...(migrationFiles.length > 0
    ? [
        {
          entry: migrationFiles,
          format: ['esm'] as const,
          splitting: false,
          clean: false,
          sourcemap: false,
          outDir: 'dist/migrations',
        },
      ]
    : []),
])
