import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.integration.spec.ts'],
    // Comparten la misma base: en serie, o se pisan entre sí.
    fileParallelism: false,
  },
});
