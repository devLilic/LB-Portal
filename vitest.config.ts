import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: __dirname,
    include: ['tests/unit/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['test/**', 'node_modules/**', 'dist/**', 'dist-electron/**', 'release/**'],
    testTimeout: 1000 * 29,
  },
})
