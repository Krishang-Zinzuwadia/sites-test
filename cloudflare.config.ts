import { defineConfig } from 'cf/config'

export default defineConfig({
  accountId: '22372f05b35ed2d2cf9d27b5a49cf807',
  worker: {
    name: 'sites-test-cursor-lerp',
    compatibilityDate: '2026-11-05',
    workersDev: true,
    assets: {
      notFoundHandling: 'single-page-application',
    },
  },
})
