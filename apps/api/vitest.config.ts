import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/db/migrate.ts', 'src/server.ts'],
    },
  },
  resolve: {
    // .js extension → .ts kaynak dosyasına yönlendir (ESM import uyumu)
    extensions: ['.ts', '.js'],
  },
});
