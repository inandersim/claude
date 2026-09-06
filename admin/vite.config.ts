import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const adminRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(adminRoot, '..');

/**
 * Panel, ana uygulamanın `src/domain` sözleşmesini ve `src/data/mock` tohum
 * verisini doğrudan kullanır. Tipler kopyalanmaz; alias ile içe aktarılır.
 * React Native'e bağlı modüller (i18n, Icon) tip düzeyinde stub'lara yönlenir.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/core\/i18n$/, replacement: path.resolve(adminRoot, 'src/shims/i18n.ts') },
      {
        find: /^@\/components\/ui\/Icon$/,
        replacement: path.resolve(adminRoot, 'src/shims/icon.ts'),
      },
      { find: /^@\/domain$/, replacement: path.resolve(appRoot, 'src/domain/index.ts') },
      { find: /^@\//, replacement: `${appRoot}/src/` },
    ],
  },
  server: {
    port: 5180,
    strictPort: true,
    fs: { allow: [appRoot] },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Tohum veri (mock) ve satıcı kodu ayrı parçalara alınır; böylece
        // panel kodu değiştiğinde büyük veri parçası önbellekte kalır.
        manualChunks(id: string) {
          if (id.includes('/src/data/mock/')) return 'seed-data';
          if (id.includes('/src/domain/')) return 'domain';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
