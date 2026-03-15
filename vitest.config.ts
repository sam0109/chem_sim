import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/data/**'],
      exclude: [
        'src/engine/worker.ts',
        'src/engine/debug.ts',
        'src/engine/tests.ts',
      ],
    },
  },
});
