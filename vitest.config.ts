import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist', 'node_modules', '.github', '.husky'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli.ts',
        'src/core/**',
        'src/**/index.ts',
        '**/*.d.ts',
        '**/*.test.ts',
      ],
    },
  },
});
