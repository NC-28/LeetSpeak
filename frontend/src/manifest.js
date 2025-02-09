import { defineManifest } from '@crxjs/vite-plugin'
import packageData from '../package.json' assert { type: 'json' }

export default defineManifest({
                                name: packageData.displayName || packageData.name,
                                description: packageData.description,
                                version: packageData.version,
                                manifest_version: 3,

                                // Removed default_popup and added side panel
                                side_panel: {
                                  default_path: "popup.html"
                                },

                                background: {
                                  service_worker: 'src/background/index.js',
                                  type: 'module',
                                },

                                content_scripts: [
                                  {
                                    matches: ['http://*/*', 'https://*/*'],
                                    js: ['src/contentScript/index.js'],
                                    run_at: "document_idle"
                                  },
                                ],

                                permissions: [
                                  'storage',
                                  'activeTab',
                                  'scripting',
                                  'sidePanel' // Required for using the side panel API
                                ],

                                host_permissions: [
                                  "<all_urls>"
                                ],

                                web_accessible_resources: [
                                  {
                                    resources: [
                                      "popup.html",
                                      "src/contentScript/index.js",
                                      "src/popup/webscraping.js",
                                      "src/popup/visualizer.js",
                                      "src/popup/mediastream.js",
                                      "sound.mp3"
                                    ],
                                    matches: ["<all_urls>"]
                                  }
                                ]
                              })
