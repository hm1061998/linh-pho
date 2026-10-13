import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    // The engine is one chunk of about 2.1 MB (535 kB gzipped). The game needs all of it at start, so it cannot be
    // lazy-loaded. The limit is set above it, so any other chunk that grows past 500 kB still shows up.
    chunkSizeWarningLimit: 2200,
    rolldownOptions: {
      output: {
        // The engine and the UI library change rarely. Keeping them in their own files lets a browser reuse them
        // after a game change, so only the small game code is downloaded again.
        codeSplitting: {
          groups: [
            { name: 'playcanvas', test: /node_modules[\\/]playcanvas[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    // Logic tests run in plain Node. Component smoke tests opt into jsdom with a `@vitest-environment jsdom` comment.
    include: ['src/tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
