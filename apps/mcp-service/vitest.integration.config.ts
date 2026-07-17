import { defineConfig } from 'vitest/config';


export default defineConfig({
  test: {
    globals: true,
    include: ['test/integration.spec.ts'],
    passWithNoTests: false,
    testTimeout: 30000,
    sequence: {
      sequential: true,
    },
  },
});
