import { readdirSync } from 'node:fs';
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
/**
 * `virtual:zirtan-modules` — deponun gerçek modül listesi.
 *
 * AI komuta merkezi, bir talebin hangi modülleri etkilediğini bu listeyle
 * bulur. Liste elle yazılmaz (eskir) ve `import.meta.glob` ile de toplanamaz:
 * glob, özellik dosyalarını paket grafiğine sokar ve react-native paneldeki
 * derlemeye sızar. Bu yüzden yalnızca **klasör adları** derleme sırasında
 * okunur; hiçbir kaynak dosya paketlenmez.
 */
function zirtanModules() {
  const virtualId = 'virtual:zirtan-modules';
  const resolvedId = `\0${virtualId}`;
  return {
    name: 'zirtan-modules',
    resolveId(id: string) {
      return id === virtualId ? resolvedId : null;
    },
    load(id: string) {
      if (id !== resolvedId) return null;
      const dirs = (rel: string) =>
        readdirSync(path.resolve(appRoot, rel), { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name);
      const files = (rel: string) =>
        readdirSync(path.resolve(appRoot, rel))
          .filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts', 'enums.ts'].includes(f))
          .map((f) => f.replace(/\.ts$/, ''));
      const modules = [...new Set([...dirs('src/features'), ...files('src/domain')])].sort();
      return `export const MODULES = ${JSON.stringify(modules)};\n`;
    },
  };
}

export default defineConfig({
  plugins: [react(), zirtanModules()],
  resolve: {
    alias: [
      { find: /^@\/core\/i18n$/, replacement: path.resolve(adminRoot, 'src/shims/i18n.ts') },
      {
        find: /^@\/components\/ui\/Icon$/,
        replacement: path.resolve(adminRoot, 'src/shims/icon.ts'),
      },
      { find: /^@\/domain$/, replacement: path.resolve(appRoot, 'src/domain/index.ts') },
      // AI CTO çekirdeği: kurallar tek yerde kalsın diye panel de aynı .mjs
      // dosyalarını içe aktarır (bkz. agents/cto/lib/*-core.mjs).
      { find: /^@cto\//, replacement: `${appRoot}/agents/cto/` },
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
