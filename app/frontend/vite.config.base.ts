import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { ManifestV3Export } from '@crxjs/vite-plugin';
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, BuildOptions } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths'
import { stripDevIcons, crxI18n } from './custom-vite-plugins';
import manifest from './manifest.json';
import devManifest from './manifest.dev.json';
import pkg from './package.json';


const isDev = process.env.__DEV__ === 'true';
// set this flag to true, if you want localization support
const localize = false;

export const baseManifest = {
    ...manifest,
    version: pkg.version,
    ...(isDev ? devManifest : {} as ManifestV3Export),
    ...(localize ? {
      name: '__MSG_extName__',
      description: '__MSG_extDescription__',
      default_locale : 'en'
    } : {})
} as ManifestV3Export

export const baseBuildOptions: BuildOptions = {
  sourcemap: isDev,
  emptyOutDir: !isDev,
  chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
  rollupOptions: {
    output: {
      manualChunks: (id) => {
        // Vendor chunks for large dependencies
        if (id.includes('node_modules')) {
          // React and related
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }
          // Markdown and syntax highlighting
          if (id.includes('react-markdown') || id.includes('highlight.js') || 
              id.includes('rehype') || id.includes('remark')) {
            return 'markdown-vendor';
          }
          // Chrome extension polyfill
          if (id.includes('webextension-polyfill')) {
            return 'webext-vendor';
          }
          // Other vendor dependencies
          return 'vendor';
        }
        
        // Separate chunks for different pages/features
        if (id.includes('/pages/panel/')) {
          return 'panel-page';
        }
        if (id.includes('/pages/popup/')) {
          return 'popup-page';
        }
        if (id.includes('/pages/options/')) {
          return 'options-page';
        }
        if (id.includes('/pages/content/')) {
          return 'content-page';
        }
        if (id.includes('/pages/background/')) {
          return 'background-page';
        }
        
        // Separate lib utilities
        if (id.includes('/lib/')) {
          return 'utils';
        }
        
        return null;
      }
    }
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    react(),
    stripDevIcons(isDev),
    crxI18n({ localize, src: './src/locales' }),
  ],
  publicDir: resolve(__dirname, 'public'),
});
