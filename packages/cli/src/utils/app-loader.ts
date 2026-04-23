import { resolve, dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'

function loadEnv(): void {
  const envPath = resolve('.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadApp(): Promise<any> {
  loadEnv()
  const projectRequire = createRequire(resolve('./package.json'))
  const corePkgPath = projectRequire.resolve('@feathers-baas/core/package.json')
  const corePkg = JSON.parse(readFileSync(corePkgPath, 'utf-8')) as {
    exports: { '.': { import: { default: string } } }
  }
  const coreEsmEntry = corePkg.exports['.'].import.default
  const coreEsmPath = join(dirname(corePkgPath), coreEsmEntry)
  const { createApp } = await import(pathToFileURL(coreEsmPath).href) as { createApp: () => Promise<unknown> }
  return createApp()
}
