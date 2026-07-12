import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    strictPort: true,
    fs: {
      // Dev-only: permite servir via /@fs/ os PDFs de teste do spike (Sprint 0)
      allow: ['..'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
