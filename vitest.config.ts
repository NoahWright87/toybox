import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // src/utils/*.test.ts use Node's built-in test runner (node --test), not vitest
    include: ['src/experiences/**/*.test.ts'],
  },
});
