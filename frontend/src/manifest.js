import { defineManifest } from '@crxjs/vite-plugin'
import packageData from '../package.json' assert { type: 'json' }

export default defineManifest({
                                name: packageData.displayName || packageData.name,
                                description: packageData.description,
                                version: packageData.version,
                                manifest_version: 3,
                                action: {
                                  default_popup: 'popup.html',
                                },
                                background: {
                                  service_worker: 'src/background/index.js',
                                  type: 'module',
                                },
                                content_scripts: [
                                  {
                                    matches: ['http://*/*', 'https://*/*'],
                                    js: ['src/contentScript/index.js'],
                                  },
                                ],
                                permissions: [
                                  'storage',
                                  'activeTab', // Allows interaction with the active tab
                                  'scripting', // Required for dynamic script injection if needed
                                ],
                                host_permissions: [
                                  "<all_urls>" // Allows content script to run on all webpages
                                ],
                                web_accessible_resources: [
                                  {
                                    resources: ["popup.html"],
                                    matches: ["<all_urls>"]
                                  }
                                ]
                              })
