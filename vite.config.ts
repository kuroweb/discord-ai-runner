import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

const builtins = new Set([
  ...builtinModules,
  ...builtinModules.map((mod) => `node:${mod}`),
]);

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    ssr: 'src/index.ts',
    target: 'node20',
    rollupOptions: {
      external: (id) => {
        if (id.startsWith('.') || id.startsWith('/')) return false;
        return builtins.has(id) || !id.startsWith('\0');
      },
      output: {
        entryFileNames: 'index.cjs',
        format: 'cjs',
      },
    },
  },
});
