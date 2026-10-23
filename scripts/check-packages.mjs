#!/usr/bin/env node
// Release guard: fail if any publishable package would ship env files, keys or other
// local-only files. Runs `npm pack --dry-run` so it checks exactly what npm would upload.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const FORBIDDEN = [
  /(^|\/)\.env($|\.(?!example))/, // .env, .env.local, .env.production — but not .env.example(.ejs)
  /(^|\/)\.npmrc$/,
  /\.(pem|key|p12|pfx)$/,
  /(^|\/)id_(rsa|ed25519)/,
]

const packagesDir = join(import.meta.dirname, '..', 'packages')
let failed = false

for (const dir of readdirSync(packagesDir)) {
  const pkgDir = join(packagesDir, dir)
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  if (pkg.private) continue

  const [{ files }] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: pkgDir, encoding: 'utf8' }))
  const bad = files.map((f) => f.path).filter((p) => FORBIDDEN.some((re) => re.test(p)))

  if (!pkg.files) {
    console.error(`✖ ${pkg.name}: no "files" allowlist in package.json`)
    failed = true
  }
  for (const p of bad) {
    console.error(`✖ ${pkg.name}: would publish ${p}`)
    failed = true
  }
  if (pkg.files && bad.length === 0) console.log(`✔ ${pkg.name}@${pkg.version}: ${files.length} files`)
}

if (failed) {
  console.error('\nRefusing to publish — fix the files above first.')
  process.exit(1)
}
