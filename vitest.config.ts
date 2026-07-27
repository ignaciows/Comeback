import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * The domain layer imports no React Native, so it runs directly in node with no
 * transform beyond TypeScript. Tests cover the models, not the screens.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
