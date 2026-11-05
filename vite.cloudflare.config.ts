import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig, mergeConfig } from 'vite'
import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig, defineConfig({
  plugins: [cloudflare()],
}))
