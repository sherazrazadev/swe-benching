import { defineNuxtConfig } from 'nuxt/config'

const modulePath = process.env.S4_MODULE_PATH || '/workspace/src/module'
const nodeCompat = process.env.S4_NODE_COMPAT
  ? { compatibility: { runtime: { satori: 'node' } } }
  : {}

export default defineNuxtConfig({
  modules: [modulePath],
  site: { url: 'https://og-s4.example' },
  ogImage: { debug: true, defaults: { renderer: 'satori' }, ...nodeCompat },
  nitro: { preset: (process.env.S4_PRESET as any) || undefined },
  devtools: { enabled: false },
  compatibilityDate: '2025-01-01',
})
