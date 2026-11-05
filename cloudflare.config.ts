import { defineConfig } from 'cf/config'

export default defineConfig({
  accountId: '22372f05b35ed2d2cf9d27b5a49cf807',
  worker: {
    name: 'sites-test',
    compatibilityDate: '2026-11-05',
    domains: ['sites-test.krishang.dev'],
    workersDev: true,
    assets: {
      notFoundHandling: 'single-page-application',
    },
  },
})
