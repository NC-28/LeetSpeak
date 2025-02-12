import { defineManifest } from '@crxjs/vite-plugin'
import packageData from '../package.json' assert { type: 'json' }

export default defineManifest({
                                  name: packageData.displayName || packageData.name,
                                  description: packageData.description,
                                  version: packageData.version,
                                  manifest_version: 3,

                                  // Use side panel instead of default popup
                                  side_panel: {
                                      default_path: "popup.html"
                                  },

                                  background: {
                                      service_worker: 'src/background/index.js',
                                      type: 'module',
                                  },

                                  content_scripts: [
                                      {
                                          // Restrict to LeetCode problem pages
                                          matches: ['https://leetcode.com/problems/*'],
                                          js: ['src/contentScript/index.js'],
                                          run_at: "document_idle"
                                      },
                                  ],

                                  permissions: [
                                      'storage',
                                      'activeTab',
                                      'scripting',
                                      'sidePanel'
                                  ],

                                  host_permissions: [
                                      'https://leetcode.com/problems/*'
                                  ],

                                  web_accessible_resources: [
                                      {
                                          resources: [
                                              "popup.html",
                                              "src/contentScript/index.js",
                                              "src/popup/webscraping.js",
                                              "src/popup/visualizer.js",
                                              "src/popup/mediastream.js"
                                          ],
                                          // Using a wildcard for the scheme prevents the invalid match pattern error
                                          matches: ["<all_urls>"]
                                      }
                                  ]
                              })
