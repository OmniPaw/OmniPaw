export default defineNuxtConfig({
  extends: ['./layer'],
  modules: ['@nuxtjs/plausible', '@nuxtjs/i18n', 'nuxt-studio'],
  css: ['~/assets/css/main.css'],
  site: {
    name: 'OmniPaw',
  },
  mdc: {
    highlight: {
      shikiEngine: 'javascript',
    },
  },
  compatibilityDate: '2026-02-26',
  vite: {
    build: {
      sourcemap: false,
    },
  },
  i18n: {
    defaultLocale: 'en',
    locales: [{
      code: 'en',
      name: 'English',
    }, {
      code: 'ig',
      name: 'Igbo',
    }],
  },
  llms: {
    domain: 'https://docus.dev',
    title: 'OmniPaw',
    description: 'Write beautiful docs with Markdown.',
    full: {
      title: 'OmniPaw',
      description: 'Write beautiful docs with Markdown.',
    },
  },
  mcp: {
    name: 'OmniPaw documentation',
    browserRedirect: '/en/ai/mcp',
  },
  studio: {
    route: '/admin',
    repository: {
      provider: 'github',
      owner: 'nuxt-content',
      repo: 'docus',
      rootDir: 'docs',
    },
  },
})
