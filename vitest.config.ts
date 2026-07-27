import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * The domain layer imports no React Native, so it runs directly in node with no
 * transform beyond TypeScript. Tests cover the models, not the screens.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
