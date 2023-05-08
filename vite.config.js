import { resolve } from 'pathe';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ComPar',
      fileName: 'compar',
    },
  },
});
