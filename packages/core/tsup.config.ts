import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/exports.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: true,
})
