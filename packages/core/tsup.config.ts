import { defineConfig } from 'tsup'

// Externalize all package imports — only bundle relative (./...) imports.
// Without this, tsup bundles deps like mongodb/pg into the output, which
// breaks Node built-in requires and bloats the bundle.
const external = [/^[^./]/]

export default defineConfig([
  {
    entry: ['src/exports.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    clean: true,
    sourcemap: true,
    external,
  },
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    external,
  },
])
