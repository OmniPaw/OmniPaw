export default defineAppConfig({
  header: {
    title: 'OmniPaw',
    logo: {
      light: '/logo/omnipaw-logo.png',
      dark: '/logo/omnipaw-logo.png', // Using the png for now as it's the official high-res one
      alt: 'OmniPaw Logo',
      favicon: '/favicon.svg',
    },
  },
  socials: {
    x: 'https://x.com/omnipaw',
    github: 'https://github.com/OmniPaw/OmniPaw',
    discord: 'https://discord.gg/omnipaw',
  },
  github: {
    rootDir: 'docs',
  },
  assistant: {
    faqQuestions: {
      en: [
        {
          category: 'Deterministic Kernel', items: [
            'What are the 15 Core Invariants?',
            'How do I boot in REPLAY mode?',
            'What is a Tick Round in OmniPaw?',
          ]
        },
        {
          category: 'Tool Governance', items: [
            'How does the ToolGate work?',
            'How to isolate a bash tool with Docker?',
            'Can I create custom permission tokens?',
          ]
        },
        {
          category: 'AI & MCP', items: [
            'How to connect an external MCP server?',
            'What is the LlmBrainAdapter?',
            'How to set temperature to 0 for determinism?',
          ]
        },
      ],
      ig: [
        {
          category: 'Ihe Nchịkwa (Kernel)', items: [
            'Gịnị bụ Iwu Isi 15?',
            'Olee otu m ga-esi malite n\'usoro REPLAY?',
            'Gịnị bụ Tick Round na OmniPaw?',
          ]
        },
        {
          category: 'Ọchịchị Ngwa Ọrụ', items: [
            'Olee otu ToolGate si arụ ọrụ?',
            'Olee otu a ga-esi kewapụ ngwa ọrụ bash na Docker?',
            'Nwere m ike imepụta permission tokens pụrụ iche?',
          ]
        },
        {
          category: 'AI & MCP', items: [
            'Olee otu a ga-esi jikọọ mcp server mpụga?',
            'Gịnị bụ LlmBrainAdapter?',
            'Olee otu a ga-esi tọọ temperature na 0 maka nchekwa?',
          ]
        },
      ],
    },
  },
  toc: {
    bottom: {
      links: [
        {
          icon: 'i-lucide-award',
          label: 'Security Certifications',
          to: '/en/essentials/security-invariants',
        },
        {
          icon: 'i-lucide-database',
          label: 'Forensic Audit Logs',
          to: '/en/essentials/audit-logs',
        },
        {
          icon: 'i-lucide-brain',
          label: 'MCP Toolkit',
          to: '/en/ai/mcp',
        },
      ],
    },
  },
  ui: {
    pageHero: {
      slots: {
        title: 'font-semibold sm:text-6xl',
        container: '!pb-0',
      },
    },
    pageCard: {
      slots: {
        container: 'lg:flex min-w-0',
        wrapper: 'flex-none',
      },
    },
  },
})
