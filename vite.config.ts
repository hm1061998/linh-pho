import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Logic tests run in plain Node. Component smoke tests opt into jsdom with a `@vitest-environment jsdom` comment.
    include: ['src/tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
