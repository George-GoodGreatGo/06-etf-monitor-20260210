import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

const MARKDOWN_PACKAGE_MARKERS = [
  '/react-markdown/',
  '/remark-gfm/',
  '/remark-',
  '/rehype-',
  '/unified/',
  '/micromark/',
  '/mdast-util-',
  '/hast-util-',
]

function manualChunks(id: string) {
  const normalizedId = id.replaceAll('\\', '/')
  if (!normalizedId.includes('/node_modules/')) return undefined

  if (
    normalizedId.includes('/react/') ||
    normalizedId.includes('/react-dom/') ||
    normalizedId.includes('/scheduler/')
  ) {
    return 'react-vendor'
  }

  if (normalizedId.includes('/react-router/') || normalizedId.includes('/react-router-dom/')) {
    return 'router-vendor'
  }

  if (normalizedId.includes('/lightweight-charts/')) {
    return 'charts-vendor'
  }

  if (normalizedId.includes('/lucide-react/')) {
    return 'icons-vendor'
  }

  if (normalizedId.includes('/xlsx/')) {
    return 'xlsx-vendor'
  }

  if (MARKDOWN_PACKAGE_MARKERS.some((marker) => normalizedId.includes(marker))) {
    return 'markdown-vendor'
  }

  return 'app-vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    legacy({
      targets: ['safari >= 13', 'ios >= 13'],
      modernPolyfills: true,
    }),
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 900_000,
        proxyTimeout: 900_000,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
