import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'stream', 'util', 'events', 'string_decoder'],
      globals: {
        Buffer: true,
        process: false, // We'll handle process ourselves
      },
    }),
  ],
  optimizeDeps: {
    include: ['pcb-stackup', 'libarchive.js', 'fflate'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})
