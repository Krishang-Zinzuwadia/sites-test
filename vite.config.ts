import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-runtime', test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler)(?:[\\/]|$)/ },
            { name: 'motion-vendor', test: /[\\/]node_modules[\\/]gsap[\\/]/ },
          ],
        },
      },
    },
  },
})
