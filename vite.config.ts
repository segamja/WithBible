import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

function readPkgVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'),
    ) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** Build id: Vercel commit SHA, else package version + timestamp */
function resolveAppVersion(): { version: string; builtAt: string } {
  const builtAt = new Date().toISOString()
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  const pkg = readPkgVersion()
  if (sha) {
    return { version: `${pkg}+${sha.slice(0, 7)}`, builtAt }
  }
  const stamp = builtAt.replace(/[-:TZ.]/g, '').slice(0, 14)
  return { version: `${pkg}+${stamp}`, builtAt }
}

function appVersionPlugin(): Plugin {
  const info = resolveAppVersion()
  const payload = JSON.stringify(
    { version: info.version, builtAt: info.builtAt },
    null,
    2,
  )

  const writeVersionFile = (dir: string) => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'version.json'), `${payload}\n`, 'utf8')
  }

  return {
    name: 'with-bible-app-version',
    config() {
      return {
        define: {
          __APP_VERSION__: JSON.stringify(info.version),
          __APP_BUILT_AT__: JSON.stringify(info.builtAt),
        },
      }
    },
    buildStart() {
      // Copied to dist by Vite; also useful for local preview
      writeVersionFile(path.resolve(rootDir, 'public'))
    },
    closeBundle() {
      writeVersionFile(path.resolve(rootDir, 'dist'))
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    appVersionPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icons/app-icon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-512-maskable.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'with BIBLE',
        short_name: 'with BIBLE',
        description: '함께 읽는 말씀, 함께 자라는 우리',
        lang: 'ko',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#FAF9F6',
        theme_color: '#172033',
        categories: ['education', 'lifestyle'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        navigateFallbackDenylist: [/version\.json$/],
        runtimeCaching: [
          {
            urlPattern: /\/version\.json$/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    watch: {
      ignored: ['**/imgs/**', '**/docs/**', '**/.cursor/**', '**/public/version.json'],
    },
  },
})
