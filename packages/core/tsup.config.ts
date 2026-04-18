import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/exports.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: true,
})
